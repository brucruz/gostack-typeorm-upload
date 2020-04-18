import { EntityRepository, Repository } from 'typeorm';

import Transaction from '../models/Transaction';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public async getBalance(): Promise<Balance> {
    const reducer = (total: number, currentValue: Transaction): number =>
      total + currentValue.value;

    const incomeTransactions: Transaction[] = await this.find({
      where: { type: 'income' },
    });
    const income = incomeTransactions.reduce(reducer, 0);

    const outcomeTransactions: Transaction[] = await this.find({
      where: { type: 'outcome' },
    });
    const outcome = outcomeTransactions.reduce(reducer, 0);

    const total = income - outcome;
    const balance = {
      income,
      outcome,
      total,
    };
    return balance;
  }
}

export default TransactionsRepository;
