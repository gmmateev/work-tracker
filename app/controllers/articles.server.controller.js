'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    errorHandler = require('./errors.server.controller'),
    Article = mongoose.model('Article'),
    ArticleHistory = mongoose.model('ArticleHistory'),
    _ = require('lodash');

/**
 * Private methods
 */
function update(req, res, article, clearGrades) {
    // Save the outdated version in the archive collection
    var articleData = article.toObject();
    delete articleData._id;
    delete articleData.created;

    var oldVersion = new ArticleHistory(articleData);
    oldVersion.originalArticle = article._id;

    oldVersion.save(function(err) {
        if (err) {
            return res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
        }
    });

    // Preserve properties that should not be changed
    delete req.body._id;
    delete req.body.__v;
    delete req.body.version;
    delete req.body.user;
    delete req.body.originalArticle;
    delete req.body.__t;

    article = _.extend(article, req.body);

    //Increase version
    article.version++;

    if (clearGrades) {
        article.grades = [];
    }

    article.save(function(err) {
        if (err) {
            return res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
        } else {
            res.json(article);
        }
    });
}

/**
 * Create a new version of the article
 */
exports.create = function(req, res) {
    if (!req.body.topic) {
        return res.status(500).send({
            message: 'A new version of an article must be assocciated with a topic. Add topic:{ObjectId} param in the body of the post request.'
        });
    }

    var newArticle = new Article(req.body);
    newArticle.user = req.user;
    newArticle.topic = req.body.topic;
    newArticle.save(function (err) {
        if (err) {
           return res.status(400).send({
               message: errorHandler.getErrorMessage(err)
           });
        } else {
            // Check that the user has submitted article for the given topic.
            var i;
            req.user.reserved.forEach(function (reserved, index) {
                if(reserved.topic.equals(req.body.topic)) {
                    i = index;
                }
            });

            req.user.reserved[i].set('submitted', true);

            req.user.save(function (err) {
                if (err) {
                   return res.status(400).send({
                       message: errorHandler.getErrorMessage(err)
                   });
                }
            });

            res.json(newArticle);
        }
    });
};

/**
 * Show the current article
 */
exports.read = function(req, res) {
    res.json(req.article);
};

/**
 * Update a article
 */
exports.update = function(req, res) {
    var article = req.article;
    update(req, res, article, true);
};

/**
 * Add a new review to an article
 */
exports.review = function (req, res) {
    var article = req.article;    

    //Catch sync errors only!
    try {
        article.grades.forEach(function (grade) {
            if (grade.user.equals(req.user._id)) {
                 throw new Error('User can give only one grade per article.');
            }
        });
    }
    catch (err){
        return res.status(400).send({
            message: err
        });
    }

    var grade = req.body;
    grade.userName = req.user.displayName;
    grade.user = req.user._id;

    article.grades.push(grade);

    article.save(function(err) {
        if (err) {
            return res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
        } else {
            res.json(article);
        }
    });
};

/**
 * Delete an article
 */
exports.delete = function(req, res) {
    var article = req.article;

    article.remove(function(err) {
        if (err) {
            return res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
        } else {
            res.json(article);
        }
    });
};

/**
 * List of Articles
 */
exports.list = function(req, res) {
    var query = {};
    if(req.query.filter === 'my')
        query.user = req.user._id;

    Article.find(query).sort('-created')
        .populate('user', 'displayName')
        .exec(function(err, articles) {
            if (err) {
                return res.status(400).send({
                    message: errorHandler.getErrorMessage(err)
                });
            } else {
                res.json(articles);
            }
    });
};

/**
 * History of given article
 */
exports.history = function(req, res) {
    var article = req.article;
    ArticleHistory.find({originalArticle: article}).sort('-created').populate('user', 'displayName').exec(function(err, articles) {
        if (err) {
            return res.status(400).send({
                message: errorHandler.getErrorMessage(err)
            });
        } else {
            res.json(articles);
        }
    });
};

/**
 * Return a revision of an article
 */
exports.revision = function (req, res) {
    res.json(req.revision);
};

/**
 * Restore version of an article
 */
exports.restore = function (req, res) {
    var revision = req.revision;
    Article.findById(revision.originalArticle)
        .exec(function(err, article) {
            if (err) {
                return res.status(400).send({
                    message: errorHandler.getErrorMessage(err)
                }); 
            }

            if (article) {
                update(req, res, article, false);
            }
            else {
                return new Error('Failed to load article ' + revision.originalArticle);
            }
        });
};

/**
 * Article middleware
 */
exports.articleByID = function(req, res, next, id) {
    Article.findById(id).populate('user', 'displayName').exec(function(err, article) {
        if (err) return next(err);
        if (!article) return next(new Error('Failed to load article ' + id));
        req.article = article;
        next();
    });
};

/**
 * Revision middleware
 */
exports.revisionByID = function(req, res, next, id) {
    ArticleHistory.findById(id).populate('user', 'displayName').exec(function(err, revision) {
        if (err) return next(err);
        if (!revision) return next(new Error('Failed to load article ' + id));
        req.revision = revision;
        next();
    });
};

/**
 * Article authorization middleware
 */
exports.hasAuthorization = function(req, res, next) {
    var article = req.article || req.revision;
    if (article.user.id !== req.user.id) {
        return res.status(403).send({
            message: 'User is not authorized'
        });
    }
    next();
};