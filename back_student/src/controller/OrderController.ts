import {validate} from 'class-validator';
import {Request, Response} from 'express';
import {getManager, getRepository} from 'typeorm';
import {Order} from '../entity/Order';
import {Product} from '../entity/Product';
import logger from '../utils/logger';

class OrderController {
  public static listAll = async (_req: Request, res: Response) => {
    logger.info('Fetching list of all orders from database');
    try {
      const orderRepository = getRepository(Order);
      const orders = await orderRepository.find({order: {id: 'ASC'}});
      logger.info({ count: orders.length }, 'Orders list retrieved');
      res.send(orders);
    } catch (error) {
      logger.error({ error }, 'API execution failed — unable to load orders');
      res.status(500).send('Unable to load orders');
    }
  };

  public static getOneById = async (req: Request, res: Response) => {
    const id: number = parseInt(req.params.id, 10);
    logger.info({ orderId: id }, 'Fetching order by id');
    try {
      const orderRepository = getRepository(Order);
      const order = await orderRepository.findOneOrFail(id);
      logger.info({ orderId: order.id, productId: order.product.id }, 'Order retrieved');
      res.status(200).send(order);
    } catch (error) {
      logger.error({ orderId: id, error }, 'API execution failed — order not found');
      res.status(404).send('Order not found');
    }
  };

  public static newOrder = async (req: Request, res: Response) => {
    const name = req.body.name;
    const amount = Number(req.body.amount);
    const productId = req.body.productId || (req.body.product && req.body.product.id);

    logger.info({ name, amount, productId }, 'Creating new order');

    if (!name || !productId || !Number.isFinite(amount) || amount <= 0) {
      logger.warn({ name, amount, productId }, 'Order creation failed — invalid payload');
      return res.status(400).send('Invalid order payload');
    }

    try {
      const result = await getManager().transaction(async manager => {
        const productRepository = manager.getRepository(Product);
        const orderRepository = manager.getRepository(Order);
        const product = await productRepository.findOneOrFail(productId);
        if (product.amount < amount) {
          throw new Error('Insufficient stock');
        }

        product.amount = product.amount - amount;
        const order = new Order();
        order.name = name;
        order.amount = amount;
        order.product = product;
        order.totalPrice = Number(product.price) * amount;

        const errors = await validate(order);
        if (errors.length > 0) {
          throw new Error('Validation failed');
        }

        await productRepository.save(product);
        return orderRepository.save(order);
      });

      logger.info(
        { orderId: result.id, productId, amount, totalPrice: result.totalPrice },
        'Order created successfully',
      );
      res.status(201).send(result);
    } catch (error) {
      logger.error({ name, amount, productId, error }, 'API execution failed — unable to create order');
      res.status(400).send('Unable to create order');
    }
  };

  public static editOrder = async (req: Request, res: Response) => {
    const id: number = parseInt(req.params.id, 10);
    const name = req.body.name;
    const amount = Number(req.body.amount);
    const requestedProductId = req.body.productId || (req.body.product && req.body.product.id);

    logger.info({ orderId: id, name, amount, productId: requestedProductId }, 'Updating order');

    if (!name || !Number.isFinite(amount) || amount <= 0) {
      logger.warn({ orderId: id }, 'Order update failed — invalid payload');
      return res.status(400).send('Invalid order payload');
    }

    try {
      const result = await getManager().transaction(async manager => {
        const productRepository = manager.getRepository(Product);
        const orderRepository = manager.getRepository(Order);
        const order = await orderRepository.findOneOrFail(id);
        const currentProduct = await productRepository.findOneOrFail(order.product.id);
        const nextProduct = await productRepository.findOneOrFail(requestedProductId || order.product.id);

        if (currentProduct.id === nextProduct.id) {
          const available = currentProduct.amount + order.amount;
          if (amount > available) {
            throw new Error('Insufficient stock');
          }
          currentProduct.amount = available - amount;
          await productRepository.save(currentProduct);
        } else {
          currentProduct.amount = currentProduct.amount + order.amount;
          if (nextProduct.amount < amount) {
            throw new Error('Insufficient stock');
          }
          nextProduct.amount = nextProduct.amount - amount;
          await productRepository.save(currentProduct);
          await productRepository.save(nextProduct);
        }

        order.name = name;
        order.amount = amount;
        order.product = currentProduct.id === nextProduct.id ? currentProduct : nextProduct;
        order.totalPrice = Number(order.product.price) * amount;

        const errors = await validate(order);
        if (errors.length > 0) {
          throw new Error('Validation failed');
        }

        return orderRepository.save(order);
      });

      logger.info({ orderId: result.id }, 'Order updated successfully');
      res.status(200).send(result);
    } catch (error) {
      logger.error({ orderId: id, error }, 'API execution failed — order not found or unable to update');
      res.status(404).send('Order not found or unable to update');
    }
  };

  public static deleteOrder = async (req: Request, res: Response) => {
    const id: number = parseInt(req.params.id, 10);
    logger.info({ orderId: id }, 'Deleting order');
    try {
      await getManager().transaction(async manager => {
        const productRepository = manager.getRepository(Product);
        const orderRepository = manager.getRepository(Order);
        const order = await orderRepository.findOneOrFail(id);
        const product = await productRepository.findOneOrFail(order.product.id);
        product.amount = product.amount + order.amount;
        await productRepository.save(product);
        await orderRepository.delete(id);
      });

      logger.info({ orderId: id }, 'Order deleted successfully');
      res.status(204).send();
    } catch (error) {
      logger.error({ orderId: id, error }, 'API execution failed — order not found');
      res.status(404).send('Order not found');
    }
  };
}

export default OrderController;
