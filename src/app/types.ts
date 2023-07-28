export interface IUserBalance {
  _id: string;
  account_number: string;
  balance: number;
  user_id: string;
  createdAt: string;
  updatedAt: string
};

declare module 'express' {
  interface Request {
    user?:  IJwtUser;
    token?: string;
  }
}

export {}

export interface IJwtUser {
  email: string;
  role: string;
  iat: number;
  exp: number;
};