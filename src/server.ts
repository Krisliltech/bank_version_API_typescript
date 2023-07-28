import express, {Request, Response, NextFunction} from 'express';
import createError from 'http-errors';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import logger from 'morgan';
import limiter from './rate-limiter';

dotenv.config();
const app = express();

const indexRouter = require('./app/index');

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(limiter)
app.use('/v1/api', indexRouter);
// catch 404 and forward to error handler
app.use(function (req: Request, res: Response, next: NextFunction) {
    next(createError(404));
});

// connect to MongoDB
mongoose.connect(process.env.MONGODB_URL as string)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error(err, 'err'));

app.use(function (err: createError.HttpError, req: Request, res: Response,_next: NextFunction) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  
  // render the error page
  res.status(404).send({
   message: `Route '${req.path}', NOT found...`,
   status: 'error'
  });
  res.status(err.status || 500);
});
  
const PORT = process.env.PORT
app.listen(PORT, ()=>{
    console.log(`Server now running on port ${PORT}`)
})

export default app;