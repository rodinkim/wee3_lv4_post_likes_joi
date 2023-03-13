const express = require('express');
const commentRouter = require ('./comments.js')
const likeRouter = require ('./likes.js')
const loginRouter = require ('./login.js')
const postRouter = require ('./posts.js')
const signupRouter = require ('./signup.js')

const router = express.Router();

// Exam 1
router.use('/comments', commentRouter)
router.use('/posts', likeRouter)
router.use('/login', loginRouter)
router.use('/posts', postRouter)
router.use('/signup', signupRouter)

module.exports = router;
