const express = require('express');
const Joi = require('joi');
const { Op } = require('sequelize');

const { Comments, Users } = require('../models');
const authMiddleware = require('../middlewares/authMiddleware');
const { parseModelToFlatObject } = require('../helpers/sequelize.helper');

const router = express.Router();

const RE_COMMENT = /^[\s\S]{1,100}$/; // 댓글 정규 표현식

const commentSchema = Joi.object({
  comment: Joi.string().pattern(RE_COMMENT).required(),
});
// 댓글 목록 조회
router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

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

    return res.status(200).json({ data: comments });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} : ${error.message}`);
    return res.status(400).json({
      errorMessage: '댓글 조회에 실패하였습니다.',
    });
  }
});

// 댓글 생성
router.post('/:postId', authMiddleware, async (req, res) => {
  try {
    const resultSchema = commentSchema.validate(req.body);
    if (resultSchema.error) {
      if(!resultSchema.value.comment){
        return res.status(412).json({
        errorMessage: '댓글 내용을 입력해주세요.',
      });
    }
        return res.status(412).json({
        errorMessage: '데이터 형식이 올바르지 않습니다.',
      });
    }

    const { postId } = req.params;
    const { comment } = resultSchema.value;
    const { userId } = res.locals.user;

    await Comments.create({ PostId: postId, UserId: userId, comment });

    return res.status(201).json({ message: '댓글을 작성하였습니다.' });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} : ${error.message}`);
    return res.status(400).json({
      errorMessage: '댓글 작성에 실패하였습니다.',
    });
  }
});

// 댓글 수정
router.put('/:commentId', authMiddleware, async (req, res) => {
  try {
    const resultSchema = commentSchema.validate(req.body);
    if (resultSchema.error) {
      if(!resultSchema.value.comment){
          return res.status(412).json({
          errorMessage: '댓글 내용을 입력해주세요.',
      });
    }
      return res.status(412).json({
        errorMessage: '데이터 형식이 올바르지 않습니다.',
      });
    }

    const { commentId } = req.params;
    const { comment } = resultSchema.value;
    const { userId } = res.locals.user;

    const isExistComment = await Comments.findByPk(commentId);
    if (!isExistComment) {
      return res.status(404).json({
        errorMessage: '댓글이 존재하지 않습니다.',
      });
    }

    const updateCount = await Comments.update(
      { comment },
      { where: { commentId, UserId: userId } }
    );

    if (updateCount < 1) {
      return res.status(400).json({
        errorMessage: '댓글 수정이 정상적으로 처리되지 않았습니다.',
      });
    }

    return res.status(200).json({ message: '댓글을 수정하였습니다.' });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} : ${error.message}`);
    return res.status(400).json({
      errorMessage: '댓글 수정에 실패하였습니다.',
    });
  }
});

// 댓글 삭제
router.delete('/:commentId', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = res.locals.user;

    const isExistComment = await Comments.findByPk(commentId);
    if (!isExistComment) {
      return res.status(404).json({
        errorMessage: '댓글이 존재하지 않습니다.',
      });
    }

    const deleteCount = await Comments.destroy({
      where: { commentId, UserId: userId },
    });

    if (deleteCount < 1) {
      return res.status(400).json({
        errorMessage: '댓글 삭제가 정상적으로 처리되지 않았습니다.',
      });
    }

    return res.status(200).json({ message: '댓글을 삭제하였습니다.' });
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} : ${error.message}`);
    return res.status(400).json({
      errorMessage: '댓글 삭제에 실패하였습니다.',
    });
  }
});

module.exports = router;
