import * as redis from 'redis';

const port: number = Number((process.env.REDIS_PORT)as string)
const host : string = process.env.REDIS_HOST as string

// redis connection
const redisClient = redis.createClient({
  socket: {
    host,
    port
  },
  password: process.env.REDIS_PASSWORD as string,
  username: process.env.REDIS_USERNAME as string
});

redisClient.connect();

redisClient.on('error', err => {
  console.error(err);
});
redisClient.on('connect', ()=> {
  console.error('Connected to Redis');
});

export default redisClient
