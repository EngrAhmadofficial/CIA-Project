import {validate} from 'class-validator';
import {Request, Response} from 'express';
import {getRepository} from 'typeorm';
import {Product} from '../entity/Product';
import logger from '../utils/logger';

const parseBoolean = (value: any): boolean => value === true || value === 'true';

class ProductController {
  public static listAll = async (_req: Request, res: Response) => {
    logger.info('Fetching list of all products from database');
    try {
      const productRepository = getRepository(Product);
      const products = await productRepository.find({order: {id: 'ASC'}});
      logger.info({ count: products.length }, 'Products list retrieved');
      res.send(products);
    } catch (error) {
      logger.error({ error }, 'API execution failed — unable to load products');
      res.status(500).send('Unable to load products');
    }
  };

  public static getOneById = async (req: Request, res: Response) => {
    const id: number = parseInt(req.params.id, 10);
    logger.info({ productId: id }, 'Fetching product by id');
    try {
      const productRepository = getRepository(Product);
      const product = await productRepository.findOneOrFail(id);
      logger.info({ productId: product.id, name: product.name }, 'Product retrieved');
      res.status(200).send(product);
    } catch (error) {
      logger.error({ productId: id, error }, 'API execution failed — product not found');
      res.status(404).send('Product not found');
    }
  };

  public static newProduct = async (req: Request, res: Response) => {
    logger.info({ name: req.body.name }, 'Creating new product');
    const product = new Product();
    product.name = req.body.name;
    product.category = req.body.category;
    product.description = req.body.description || '';
    product.amount = Number(req.body.amount);
    product.price = Number(req.body.price);
    product.hasExpiryDate = parseBoolean(req.body.hasExpiryDate);

    const errors = await validate(product);
    if (errors.length > 0) {
      logger.warn({ name: product.name, errors }, 'Product creation validation failed');
      return res.status(400).send(errors);
    }

    try {
      const productRepository = getRepository(Product);
      const savedProduct = await productRepository.save(product);
      logger.info({ productId: savedProduct.id, name: savedProduct.name }, 'Product created successfully');
      res.status(201).send(savedProduct);
    } catch (error) {
      logger.error({ name: product.name, error }, 'API execution failed — product could not be saved');
      res.status(409).send('Product already exists or could not be saved');
    }
  };

  public static editProduct = async (req: Request, res: Response) => {
    const id: number = parseInt(req.params.id, 10);
    logger.info({ productId: id }, 'Updating product');
    try {
      const productRepository = getRepository(Product);
      const product = await productRepository.findOneOrFail(id);
      product.name = req.body.name !== undefined ? req.body.name : product.name;
      product.category = req.body.category !== undefined ? req.body.category : product.category;
      product.description = req.body.description !== undefined ? req.body.description : product.description;
      product.amount = req.body.amount !== undefined ? Number(req.body.amount) : product.amount;
      product.price = req.body.price !== undefined ? Number(req.body.price) : product.price;
      product.hasExpiryDate = req.body.hasExpiryDate !== undefined ? parseBoolean(req.body.hasExpiryDate) : product.hasExpiryDate;

      const errors = await validate(product);
      if (errors.length > 0) {
        logger.warn({ productId: id, errors }, 'Product update validation failed');
        return res.status(400).send(errors);
      }

      const savedProduct = await productRepository.save(product);
      logger.info({ productId: savedProduct.id }, 'Product updated successfully');
      res.status(200).send(savedProduct);
    } catch (error) {
      logger.error({ productId: id, error }, 'API execution failed — product not found or update failed');
      res.status(404).send('Product not found');
    }
  };

  public static deleteProduct = async (req: Request, res: Response) => {
    const id: number = parseInt(req.params.id, 10);
    logger.info({ productId: id }, 'Deleting product');
    try {
      const productRepository = getRepository(Product);
      await productRepository.findOneOrFail(id);
      await productRepository.delete(id);
      logger.info({ productId: id }, 'Product deleted successfully');
      res.status(204).send();
    } catch (error) {
      logger.error({ productId: id, error }, 'API execution failed — product not found');
      res.status(404).send('Product not found');
    }
  };
}

export default ProductController;
