import express from 'express';
import { signup, signin, getAccessToken, creditUserAccount, transfer, logout } from './controller';
import { authenticateUser, authorizeUser, verifyRefreshToken } from './middleWare';

const router = express.Router();


router.post('/signup', signup);

router.post('/signin', signin);

router.post('/refresh/token', verifyRefreshToken, getAccessToken);

router.post('/credit-acct', authenticateUser, authorizeUser(['admin']),  creditUserAccount);

router.post('/transfer', authenticateUser, authorizeUser(['user','admin']), transfer);

router.get('/logout', authenticateUser, logout)

module.exports = router;
