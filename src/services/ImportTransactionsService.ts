import fs from 'fs';
import csvParse from 'csv-parse';
import { getCustomRepository, getRepository, In } from 'typeorm';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

export default class ImportTransactionsService {
  // async execute({ transactions_filename }: Request): Promise<void> {
  async execute(filePath: string): Promise<Transaction[]> {
    // TODO
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const transactionsReadStream = fs.createReadStream(filePath);

    const parsers = csvParse({
      from_line: 2,
    });

    // conforme a linha for disponível para a leitura, o pipe vai lendo linha a linha
    const parseCSV = transactionsReadStream.pipe(parsers);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    // a cada evento 'data', uma nova linha é disponibilizada
    parseCSV.on('data', async row => {
      const [title, type, value, category] = row.map((cell: string) =>
        cell.trim(),
      );

      // verificar se variáveis estão chegando corretamente
      if (!title || !type || !value) return;

      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    // a promise aguarda o parseCSV disponibilizar o evento de 'end', ao terminar de ler todas as linhas
    await new Promise(resolve => parseCSV.on('end', resolve));

    // verificar se categorias existem no BD
    const existentCategories = await categoriesRepository.find({
      where: {
        // verificar se dentro da array categories, alguma das categorias existe como title
        title: In(categories),
      },
    });

    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    // Descobrir as categorias que não estão no BD
    const addCategoryTitles = categories
      .filter(
        // encontrar dentro das categorias listadas, aquelas que não estão inclusas dentro da listagem
        category => !existentCategoriesTitles.includes(category),
      )
      // filtrar entradas duplicadas
      .filter((value, index, self) => {
        return self.indexOf(value) === index;
      });

    // criar as novas categorias
    const newCategories = categoriesRepository.create(
      // para cada categoria, criar um objeto
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(filePath);

    return createdTransactions;
  }
}
