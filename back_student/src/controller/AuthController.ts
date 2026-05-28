import {validate} from 'class-validator';
import {Request, Response} from 'express';
import * as jwt from 'jsonwebtoken';
import {getRepository} from 'typeorm';
import config from '../config/config';
import {User} from '../entity/User';
import logger from '../utils/logger';

class AuthController {

  public static register = async (req: Request, res: Response) => {
    const {username, password} = req.body;
    logger.info({ username }, 'User registration requested');

    const user = new User();
    user.username = username;
    user.password = password;
    user.role = "NORMAL";

    const errors = await validate(user);
    if (errors.length > 0) {
      logger.warn({ username, errors }, 'User registration validation failed');
      res.status(400).send(errors);
      return;
    }

    user.hashPassword();

    const userRepository = getRepository(User);
    try {
      await userRepository.save(user);
    } catch (error) {
      logger.warn({ username, error }, 'User registration failed — username already in use');
      res.status(409).send('username already in use');
      return;
    }

    logger.info({ userId: user.id, username: user.username }, 'User registered successfully');
    res.status(201).send('User created');
  };

  public static login = async (req: Request, res: Response) => {
    const {username, password} = req.body;
    logger.info({ username }, 'Login attempt');

    if (!(username && password)) {
      logger.warn({ username }, 'Login failed — invalid request body');
      return res.status(400).send('Invalid request body');
    }

    const userRepository = getRepository(User);
    let user: User;
    try {
      user = await userRepository.findOneOrFail({
        where: {username},
      });
    } catch (error) {
      logger.warn({ username, error }, 'Login failed — user not found');
      res.status(401).send('username or password incorrect');
      return;
    }

    if (!user.checkIfUnencryptedPasswordIsValid(password)) {
      logger.warn({ username, userId: user.id }, 'Login failed — invalid password');
      res.status(401).send('username or password incorrect');
      return;
    }

    const token = jwt.sign(
      {userId: user.id, username: user.username},
      config.jwtSecret,
      {expiresIn: '1h'},
    );
    logger.info({ userId: user.id, username: user.username }, 'User successfully logged in');
    res.send({token});
  };

  public static getMe = async (req: Request, res: Response) => {
    const userId = res.locals.jwtPayload.userId;
    logger.info({ userId }, 'Fetching authenticated user profile');

    const userRepository = getRepository(User);
    let user: User;
    try {
      user = await userRepository.findOneOrFail({
        select: ['id', 'username', 'role'],
        where: {id: userId},
      });
      logger.info({ userId: user.id, role: user.role }, 'User profile retrieved');
      res.send(user);
    } catch (error) {
      logger.error({ userId, error }, 'API execution failed — user profile not found');
      res.status(404).send('User not found');
      return;
    }
  };

  public static changePassword = async (req: Request, res: Response) => {
    const id = res.locals.jwtPayload.userId;
    logger.info({ userId: id }, 'Password change requested');

    const {oldPassword, newPassword} = req.body;
    if (!(oldPassword && newPassword)) {
      logger.warn({ userId: id }, 'Password change failed — invalid request body');
      return res.status(400).send('Invalid request body');
    }

    const userRepository = getRepository(User);
    let user: User;
    try {
      user = await userRepository.findOneOrFail(id);
    } catch (error) {
      logger.error({ userId: id, error }, 'API execution failed — user not found for password change');
      res.status(401).send();
      return;
    }

    if (!user.checkIfUnencryptedPasswordIsValid(oldPassword)) {
      logger.warn({ userId: id }, 'Password change failed — old password mismatch');
      res.status(401).send();
      return;
    }

    user.password = newPassword;
    const errors = await validate(user);
    if (errors.length > 0) {
      logger.warn({ userId: id, errors }, 'Password change validation failed');
      res.status(400).send(errors);
      return;
    }

    user.hashPassword();
    await userRepository.save(user);
    logger.info({ userId: id }, 'Password changed successfully');
    res.status(204).send();
  };
}
export default AuthController;
