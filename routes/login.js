const express = require('express');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

const { Users } = require('../models');
const authLoginUserMiddleware = require('../middlewares/authLoginUserMiddleware');

const router = express.Router();

const loginSchema = Joi.object({
  nickname: Joi.string().required(),
  password: Joi.string().required(),
});

router.post('/', authLoginUserMiddleware, async (req, res) => {
  try {
    const { nickname, password } = await loginSchema.validateAsync(req.body);
    const user = await Users.findOne({
      where: {
        [Op.and]: [{ nickname }, { password }],
      },
    });

    if (!user) {
      return res.status(412).send({
        errorMessage: '닉네임 또는 패스워드를 확인해주세요.',
      });
    }

    let expires = new Date();
    expires.setMinutes(expires.getMinutes() + 60); // expires의 시간을 현재 시간의 60분 후로 설정

    const token = jwt.sign(
      { userId: user.userId },
      'Secret Key',
      { expiresIn: '1h' },
    );

    res.cookie('middleProjectCookie', `Bearer ${token}`, {
      expires: expires, // cookie의 만료시간 설정
    });

    return res.status(200).json({ token });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} : ${error.message}`);
    return res.status(400).send({
      errorMessage: '로그인에 실패하였습니다.',
    });
  }
});

module.exports = router;
