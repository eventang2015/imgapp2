var express = require('express');
var router = express.Router();
var aws = require('aws-sdk');

var db = require('../model');
var upload = require('../utils/upload');
var auth = require('../utils/auth');
var s3 = new aws.S3();

var AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID;
var AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY;
var S3_BUCKET = process.env.S3_BUCKET;

aws.config.update({accessKeyId: AWS_ACCESS_KEY , secretAccessKey: AWS_SECRET_KEY });

router.get('/', function (req, res) {
  var limit = req.query.limit || 6;
  var start = req.query.start - 1 || 0;
  db.Image.findAll({ order: '"createdAt" DESC', offset: start, limit: limit }).then(function (images) {
    res.json(images);
  });
});

router.get('/:id', function (req, res) {
  db.Image.findOne({
    where: { id: req.params.id },
    include: {
      order: '"createdAt" ASC',
      model: db.Comment,
      include: {
        model: db.User
      } 
    }
  }).then(function (image) {
    //todo: delete password!
    if (image.Comments.length !== 0) {
      image.Comments.forEach(function(comment) {
        if (comment.User && comment.User.password) {
          comment.User.password = null;
        }
      });
    }
    res.json(image);
  });
});

router.post('/', auth, upload.single('image'), function (req, res) {
  // var filetype = req.file.originalname.split('.')[1].slice(0, 4);
  sendToS3('15.jpg', req, res);
});

function sendToS3(newFilename, req, res) {
  var s3_params = {
      Bucket: S3_BUCKET,
      Key: newFilename,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read'
    };

    s3.upload(s3_params, function (err, data) {
      console.log(err, data);
      //res.redirect(data.Location);
      res.redirect('../#/users/' + req.session.userId);
    });
}

router.post('/:id/comment', function (req, res) {
  var newComment = req.body;
  newComment.UserId = req.session.userId;
  newComment.ImageId = req.params.id;

  db.Comment.create(newComment).then(function (comment) {
    res.json(comment);
  });
});

function insertImage(userid, filetype, cb) {
  var newImage = {
      UserId: userid,
  }
  db.Image.create(newImage)
      .then(function (image) {
          db.Image.update({ filename: image.id + '.' + filetype}, 
              { where: { id: image.id }});
          console.log("image.id: " + image.id + ", image.filename: " + image.filename);
          cb(image.filename);
      })
      .catch(function (error) {
          console.log("ERROR: ", error);
      });
}

module.exports = router;