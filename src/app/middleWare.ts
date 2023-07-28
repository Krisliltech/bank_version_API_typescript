import { Request, Response, NextFunction } from 'express';
import redisClient from '../redis';
import jwt from 'jsonwebtoken';
import { IJwtUser } from './types';

const accessSecret: string = process.env.JWT_ACCESS_SECRET as string;
const refreshSecret: string = process.env.JWT_REFRESH_SECRET as string;

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send({ error: 'Authorization header missing' });
    }
    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, accessSecret)  
    if(!decoded) return res.status(401).send({ error: "Error verifying token"});
    const user = decoded as IJwtUser
    req.user = user;
    req.token = token;

    let blacklistedToken = await redisClient.get('BL_' + user.email);
    if(blacklistedToken && blacklistedToken === token ) return res.status(401).send({ error: "Invalid token"}); 
    next();
  } catch (err) {
    return res.status(401).send({ message: "Unable To Authenticate User.", data: err});
  }
};

export const authorizeUser = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req!.user!.role)) {
      return res.status(403).send({ error: 'Access denied' });
    }
    next();
  };
};

export async function verifyRefreshToken(req: Request, res: Response, next: NextFunction) {
  const token = req.body.token;
  if(!token) return res.status(401).send({ error: "Token cannot be empty"});
  try {    
    const decoded = jwt.verify(token, refreshSecret)  
    if(!decoded) return res.status(401).send({ error: "Error verifying token"}); 
    const user = decoded as IJwtUser
    req.user = user;

    // verify if refresh token is in store or not
    let refresh_token = await redisClient.get(user.email);  
    if(!refresh_token) return res.status(401).send({ error: "Error validating token"});      
    next();
  } catch (err) {
      return res.status(401).send({ message: "Session expired", data: err});
  }
}