import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from './model/user';
import UserBalance from './model/user-balance';
import Transaction from './model/transaction';
import redisClient from '../redis';
import bcrypt from 'bcrypt';
import { IJwtUser } from './types';

const accessSecret: string = process.env.JWT_ACCESS_SECRET as string;
const refreshSecret: string = process.env.JWT_REFRESH_SECRET as string;

export async function signup(req: Request, res: Response) {
  try {
    const { name, email, phone_number, password, admin_token } = req.body;
    const existingUser = await User.findOne({ $or: [{ email }, { phone_number }] })
    
    if (existingUser) {
      return res.status(400).send({ error: 'Email or Phone Number already exists.' });
    }

    let role
    if (admin_token && admin_token !== process.env.ADMIN_TOKEN){
      return res.status(400).send({ error: 'Invalid Admin token to create admin account.' });
    } else if (admin_token && admin_token === process.env.ADMIN_TOKEN){
      role = 'admin'
    }
    const user = new User({ name, email, phone_number, password, role });
    const result = await user.save();

    const account_number = phone_number.slice(1)
    const userBalance = new UserBalance({account_number, user_id: result._id})
    const acct =  await userBalance.save()

    if (!acct) {
      await User.deleteOne({_id: result._id})
      return res.status(400).send({ error: 'Error creating user details, please try again later.' });
    }

    res.status(201).send({ message: 'User created successfully',  account_number });
  } catch (err) {
    return res.status(400).send(err.message);
  }
};

export async function signin(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).send({ error: 'User with email not found' });
    } else {
      const comparePassword = await bcrypt.compare(password, user.password)
      if (!comparePassword) {
        return res.status(401).send({ error: 'Invalid credentials' });
      }
      
      const accessToken = jwt.sign({ email, role: user.role }, accessSecret, { expiresIn: process.env.JWT_ACCESS_TIME });
      const refreshToken = await generateRefreshToken(email, user.role)
    
      return res.status(200).send({  message: 'Login successful', data: { accessToken, refreshToken }});
    }
  } catch (err) {
    return res.status(401).send(err.message);
  }
};

async function generateRefreshToken(email: string, role: string) {
  try {
    let refresh_token = await redisClient.get(email);
    if(!refresh_token) {
      refresh_token = await signRefreshToken(email, role)
    }

    const decoded = jwt.verify(refresh_token, refreshSecret)    
    if(!decoded) {
      refresh_token = await signRefreshToken(email, role)
    }
    return refresh_token;
  } catch (err) {    
    if (err.message === 'jwt expired'){
      const refresh_token = await signRefreshToken(email, role)
      return refresh_token;
    }
  }
}

async function signRefreshToken(email: string, role: string) {
  const refresh_token = jwt.sign({ email, role }, refreshSecret, { expiresIn: process.env.JWT_REFRESH_TIME });
  // set refresh token in Redis
  await redisClient.set(email, refresh_token);
  return refresh_token;
}

export async function getAccessToken (req: Request, res: Response) {
  const user = req.user as IJwtUser;
  const access_token = jwt.sign({email: user.email, role: user.role}, accessSecret, { expiresIn: process.env.JWT_ACCESS_TIME});

  return res.status(200).send({ message: "success", data: { access_token }});
}

export async function creditUserAccount(req: Request, res: Response) {
  try {
    const { amount, account_number } = req.body
    if(!account_number) {
      return res.status(400).send({ message: 'Account number must be provided' });
    }
    if (amount <= 0 || !validateAmount(amount)) {
      return res.status(400).send({ message: 'Invalid credit amount' });
    }
    let checkIfAccountExists = await UserBalance.findOne({account_number});
    if(!checkIfAccountExists) {
      return res.status(400).send({ message: 'Invalid account number' });
    }

    checkIfAccountExists.balance += amount
    checkIfAccountExists.updatedAt = new Date()
    const updatedUserBalance = await checkIfAccountExists.save()
    if (!updatedUserBalance) {
      return res.status(200).send({ message: 'Transaction error, please try again' });
    }

    return res.status(200).send({ message: 'Transaction Successful' });
  } catch (err) {
    return res.status(400).send(err.message);
  }
}

function validateAmount(amount: Number) {
  const regex  = /^\d+(?:\.{0,1}\d{1,2})$/;
  const amountString = String(amount);;
  if(regex.test(amountString)){
    return true
  }
  return false
}

export async function transfer(req: Request, res: Response) {
  try {
    const { email } = req.user as IJwtUser;
    const { to, amount, remarks } = req.body;

    const existingUser = await User.findOne({email})
    let loggedInUserAccountDetails = await UserBalance.findOne({ user_id: existingUser!._id});
    let acctFrom = loggedInUserAccountDetails!.account_number
  
    let acctTo = await UserBalance.findOne({account_number: to});
    if ( !acctTo ) return res.status(400).send({ message: 'Invalid account number' });
    if (acctFrom === to) {
      return res.status(400).send({ message: 'Cannot transfer to the same account number' });
    }else {
      if (acctFrom && to) {
        if (loggedInUserAccountDetails!.balance < amount) {
          return res.status(400).send({ message: 'Insufficient account balance' });
        } else if(amount <= 0 || !validateAmount(amount)) {
          return res.status(400).send({ message: 'Invalid transfer amount' });
        } else {
          const transactionData = new Transaction({
            sender_account_number: acctFrom,
            amount,
            receiver_account_number: to,
            transferDescription: remarks || '',
          });
          const successfulTranaction = await transactionData.save();

          if(!successfulTranaction){
            return res.status(400).send({ message: 'Transaction error, please try again' });
          }

          loggedInUserAccountDetails!.balance -= amount
          loggedInUserAccountDetails!.updatedAt = new Date()
          acctTo.balance += amount
          acctTo.updatedAt = new Date()

          const updatedAcctFrom = await loggedInUserAccountDetails!.save()
          const updatedAcctTo = await acctTo.save() 
         
          if(!updatedAcctFrom){
            await Transaction.deleteOne({_id: successfulTranaction._id})
            return res.status(400).send({ message: 'Transaction error, please try again' });
          } 
          if(!updatedAcctTo){
            await Transaction.deleteOne({_id: successfulTranaction._id})
            loggedInUserAccountDetails!.balance += amount
            await loggedInUserAccountDetails!.save()
            return res.status(400).send({ message: 'Transaction error, please try again' });
          }
          
          return res.status(200).send({ message: 'Transaction Successful' });
        }
      } else {
        return res.status(404).send({ message: 'Account does not exist' });
      }
    }  
  } catch (err) {
    return res.status(400).send(err.message);
  }
};

export async function logout (req: Request, res: Response) {
  const user = req.user as IJwtUser;
  const token = req.token as string;
 
  // remove the refresh token
  await redisClient.del(user.email);

  // blacklist current access token
  await redisClient.set('BL_' + user.email , token);
  
  return res.status(200).send({message: 'You have successfull logged out'});
}