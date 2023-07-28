import Mongoose from 'mongoose';

const transactionSchema = new Mongoose.Schema({
  sender_account_number: {
    type: String,
    required: true,
  },
  receiver_account_number: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  transferDescription: String,
  date: {
    type: Date,
    default: Date.now,
  },
});

export default Mongoose.model('Transaction', transactionSchema);
