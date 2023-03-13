const express = require('express');
const Joi = require('joi');
const { Op } = require('sequelize');

const { Posts, Comments, Likes, sequelize, Users } = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');
const { parseModelToFlatObject } = require('../helpers/sequelize.helper');
const { isRegexValidation } = require('../helpers/regex.helper');

const router = express.Router();

const RE_TITLE = /^[a-zA-Z0-9\s\S]{1,40}$/; //게시글 제목 정규 표현식
const RE_HTML_ERROR = /<[\s\S]*?>/; // 게시글 HTML 에러 정규 표현식
const RE_CONTENT = /^[\s\S]{1,3000}$/; // 게시글 내용 정규 표현식

const postSchema = Joi.object({
  title: Joi.string().required(),
  content: Joi.string().required(),
});

// 모든 게시글 조회
router.get('/', async (req, res) => {
  try {
    const posts = await Posts.findAll({
      attributes: [
        'postId',
        'title',
        'createdAt',
        'updatedAt',
        [sequelize.fn('COUNT', sequelize.col('Likes.PostId')), 'likes'],
      ],
      include: [
        {
          model: Users,
          attributes: ['userId', 'nickname'],
        },
        {
          model: Likes,
          attributes: [],
          required: false,
        },
      ],
      group: ['Posts.postId'],
      order: [['createdAt', 'DESC']],
      raw: true, // raw: true를 하면 데이터를 JSON 형태로 반환해준다.
    }).then((models) => models.map(parseModelToFlatObject));

    return res.status(200).json({ data: posts });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} : ${error.message}`);
    return res.status(400).json({
      errorMessage: '게시글 조회에 실패하였습니다.',
    });
  }
});

// 개시글 생성
router.post('/', authMiddleware, async (req, res) => {
  try {
    const resultSchema = postSchema.validate(req.body);
    if (resultSchema.error) {
      return res.status(412).json({
        errorMessage: '데이터 형식이 올바르지 않습니다.',
      });
    }

    const { title, content } = resultSchema.value;
    const { userId } = res.locals.user;

    if (
      !isRegexValidation(title, RE_TITLE) ||
      isRegexValidation(title, RE_HTML_ERROR)
    ) {
      return res.status(412).json({
        errorMessage: '게시글 제목의 형식이 일치하지 않습니다.',
      });
    }
    if (!isRegexValidation(content, RE_CONTENT)) {
      return res.status(412).json({
        errorMessage: '게시글 내용의 형식이 일치하지 않습니다.',
      });
    }

    await Posts.create({ UserId: userId, title, content });
    return res.status(201).json({ message: '게시글 작성에 성공하였습니다.' });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} : ${error.message}`);
    return res.status(400).json({
      errorMessage: '게시글 작성에 실패하였습니다.',
    });
  }
});

// 게시글 상세 조회
router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    let post = await Posts.findOne({
      attributes: [
        'postId',
        'title',
        'content',
        'createdAt',
        'updatedAt',
        [sequelize.fn('COUNT', sequelize.col('Likes.PostId')), 'likes'],
      ],
      where: { postId },
      include: [
        {
          model: Users,
          attributes: ['userId', 'nickname'],
        },
        {
          model: Likes,
          attributes: [],
          required: false,
        },
      ],
      group: ['Posts.postId'],
      order: [['postId', 'DESC']],
      raw: true,
    }).then(parseModelToFlatObject);

    const comments = await Comments.findAll({
      attributes: ['commentId', 'comment', 'createdAt', 'updatedAt'],
      include: [
        {
          model: Users,
          attributes: ['userId', 'nickname'],
        },
      ],
      where: { [Op.and]: [{ PostId: postId }] },
      order: [['createdAt', 'DESC']],
      raw: true,
    }).then((models) => models.map(parseModelToFlatObject));

    post.comments = comments;

    res.json({ data: post });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} : ${error.message}`);
    return res.status(400).json({
      errorMessage: '게시글 조회에 실패하였습니다.',
    });
  }
});

// 게시글 수정
router.put('/:postId', authMiddleware, async (req, res) => {
  try {
    const resultSchema = postSchema.validate(req.body);
    if (resultSchema.error) {
      return res.status(412).json({
        errorMessage: '데이터 형식이 올바르지 않습니다.',
      });
    }

    const { postId } = req.params;
    const { title, content } = resultSchema.value;
    const { userId } = res.locals.user;

    if (
      !isRegexValidation(title, RE_TITLE) ||
      isRegexValidation(title, RE_HTML_ERROR)
    ) {
      return res.status(412).json({
        errorMessage: '게시글 제목의 형식이 일치하지 않습니다.',
      });
    }
    if (!isRegexValidation(content, RE_CONTENT)) {
      return res.status(412).json({
        errorMessage: '게시글 내용의 형식이 일치하지 않습니다.',
      });
    }

    const updateCount = await Posts.update(
      { title, content },
      { where: { postId, UserId: userId } }
    );

    if (updateCount < 1) {
      return res.status(401).json({
        errorMessage: '게시글이 정상적으로 수정되지 않았습니다.',
      });
    }
    return res.status(200).json({ message: '게시글을 수정하였습니다.' });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} : ${error.message}`);
    return res.status(400).json({
      errorMessage: '게시글 수정에 실패하였습니다.',
    });
  }
});

// 게시글 삭제
router.delete('/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const { userId } = res.locals.user;

    const post = await Posts.findByPk(postId);
    if (!post) {
      return res.status(404).json({
        errorMessage: '게시글이 존재하지 않습니다.',
      });
    }
    if (post.UserId !== userId) {
      return res.status(401).json({
        errorMessage: '게시글을 삭제할 권한이 없습니다.',
      });
    }

    const deleteCount = await Posts.destroy({
      where: { postId, UserId: userId },
    });

    if (deleteCount < 1) {
      return res.status(401).json({
        errorMessage: '게시글이 정상적으로 삭제되지 않았습니다.',
      });
    }

    return res.status(201).json({ message: '게시글을 삭제하였습니다.' });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} : ${error.message}`);
    return res.status(400).json({
      errorMessage: '게시글 삭제에 실패하였습니다.',
    });
  }
});

module.exports = router;
