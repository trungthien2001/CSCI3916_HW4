var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authController = require('./auth');
require('dotenv').config({ path: './.env' });
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');
var mongoose = require('mongoose');
var rp = require('request-promise');
const crypto = require("crypto");

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

const GA_TRACKING_ID = process.env.GA_KEY;

function trackDimension(category, action, label, value, dimension, metric) {

    var options = { method: 'GET',
        url: 'https://www.google-analytics.com/collect',
        qs:
            {   // API Version.
                v: '1',
                // Tracking ID / Property ID.
                tid: GA_TRACKING_ID,
                // Random Client Identifier. Ideally, this should be a UUID that
                // is associated with particular user, device, or browser instance.
                cid: crypto.randomBytes(16).toString("hex"),
                // Event hit type.
                t: 'event',
                // Event category.
                ec: category,
                // Event action.
                ea: action,
                // Event label.
                el: label,
                // Event value.
                ev: value,
                // Custom Dimension
                cd1: dimension,
                // Custom Metric
                cm1: metric
            },
        headers:
            {  'Cache-Control': 'no-cache' } };

    return rp(options);
}

function getJSONObjectForMovieRequirement(req) {
    var json = {
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function (req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({ success: false, msg: 'Please include both username and password to signup.' })
    } else {

        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function (err) {
            if (err) {
                if (err.code === 11000) {
                    return res.json({success: false, message: 'A user with that username already exists'});
                } else {
                    return res.json(err);
                }
            }
            res.json({ success: true, msg: 'Successfully created new user.' });
        });
    }
});

router.post('/signin', function (req, res) {

    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function (err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function (isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json({ success: true, token: 'JWT ' + token });
            }
            else {
                res.status(401).send({ success: false, msg: 'Authentication failed.' });
            }
        })
    })
});

router.route('/movies/:movie_title')
    .get(authJwtController.isAuthenticated, function (req, res) {
        if (req.query && req.query.reviews && req.query.reviews === "true") {

            Movie.findOne({title: req.params.movie_title}, function(err, movie) {
                if (err) {
                    return res.status(403).json({success: false, message: "Unable to get reviews for title passed in"});
                } else if (!movie) {
                    return res.status(403).json({success: false, message: "Unable to find title passed in."});
                } else {

                    Movie.aggregate()
                        .match({_id: mongoose.Types.ObjectId(movie._id)})
                        .lookup({from: 'reviews', localField: '_id', foreignField: 'movie_id', as: 'reviews'})
                        .addFields({averaged_rating: {$avg: "$reviews.rating"}})
                        .exec (function(err, mov) {
                            if (err) {
                                return res.status(403).json({success: false, message: "The movie title parameter was not found."});
                            } else {
                                return res.status(200).json({success: true, message: "Movie title passed in and it's reviews were found.", movie: mov});
                            }

                        })
                }
            })
        } else {
            Movie.find({title: req.params.movie_title}).select("title year_released genre actors").exec(function (err, movie) {
                if (err) {
                    return res.status(403).json({success: false, message: "Unable to retrieve title passed in."});
                }
                if (movie && movie.length > 0) {
                    return res.status(200).json({
                        success: true,
                        message: "Successfully retrieved movie.",
                        movie: movie
                    });
                } else {
                    return res.status(404).json({
                        success: false,
                        message: "Unable to retrieve a match for title passed in."
                    });
                }

            })
        }
    });

router.route('/search/:key_word')
    .get(authJwtController.isAuthenticated, function (req, res) {

        var searchKey = new RegExp(req.params.key_word, 'i')
        Movie.find({title: searchKey}, function(err, docs) {
            if (err) {
                return res.status(403).json({success: false, message: "Unable to retrieve title passed in."});
            }
            if (docs && docs.length > 0) {
                return res.status(200).json({
                    success: true,
                    message: "Successfully retrieved movie.",
                    movie: docs
                });
            } else {
                return res.status(404).json({
                    success: false,
                    message: "Unable to retrieve a match for title passed in."
                });
            }
        })
    });

router.route('/movies')
    .post(authJwtController.isAuthenticated, function (req, res) {
        if (!req.body.title || !req.body.year_released || !req.body.genre || !req.body.actors[0] || !req.body.actors[1] || !req.body.actors[2]) {
            return res.json({ success: false, message: 'Please include all information for title, year released, genre, and 3 actors.'});
        } else {
            var movie = new Movie();

            movie.title = req.body.title;
            movie.year_released = req.body.year_released;
            movie.genre = req.body.genre;
            movie.actors = req.body.actors;

            movie.save(function (err) {
                if (err) {
                    if (err.code === 11000) {
                        return res.json({ success: false, message: "That movie already exists."});
                    } else {
                        return res.send(err);
                    }
                } else {
                    return res.status(200).send({success: true, message: "Successfully created movie."});
                }
            });
        }
    })
    .put(authJwtController.isAuthenticated, function (req, res) {
        if (!req.body.find_title || !req.body.update_title) {
            return res.json({ success: false, message: "Please provide a title to be updated as well as the new updated title."});
        } else {
            Movie.findOneAndUpdate( req.body.find_title, req.body.update_title, function (err, movie) {
                if (err) {
                    return res.status(403).json({success: false, message: "Unable to update title passed in."});
                } else if (!movie) {
                    return res.status(403).json({success: false, message: "Unable to find title to update."});
                } else {
                    return res.status(200).json({success: true, message: "Successfully updated title."});
                }
            });
        }
    })
    .delete(authJwtController.isAuthenticated, function (req, res) {
        if (!req.body.find_title) {
            return res.json({ success: false, message: "Please provide a title to delete." });
        } else {
            Movie.findOneAndDelete( req.body.find_title, function (err, movie) {
                if (err) {
                    return res.status(403).json({success: false, message: "Unable to delete title passed in."});
                } else if (!movie) {
                    return res.status(403).json({success: false, message: "Unable to find title to delete."});
                } else {
                    return res.status(200).json({success: true, message: "Successfully deleted title."});
                }
            });
        }
    })
    .get(authJwtController.isAuthenticated, function (req, res) {

        if (req.query && req.query.reviews && req.query.reviews === "true") {

            Movie.find(function (err, movies) {
                if (err) {
                    return res.status(403).json({success: false, message: "Unable to get reviews for titles"});
                } else if (!movies) {
                    return res.status(403).json({success: false, message: "Unable to find titles"});
                } else {

                    Movie.aggregate()
                        // .match({_id: mongoose.Types.ObjectId(movie._id)})
                        .lookup({from: 'reviews', localField: '_id', foreignField: 'movie_id', as: 'reviews'})
                        .addFields({averaged_rating: {$avg: "$reviews.rating"}})
                        .exec(function (err, mov) {
                            if (err) {
                                return res.status(403).json({
                                    success: false,
                                    message: "The movie title parameter was not found."
                                });
                            } else {
                                mov.sort((a,b) => { return b.averaged_rating - a.averaged_rating; });
                                return res.status(200).json({
                                    success: true,
                                    message: "Movie title passed in and it's reviews were found.",
                                    movie: mov
                                });
                            }
                        })
                }
            })
        }

        else {
            // Movie.find(req.body.find_title).select("title year_released genre actors").exec(function (err, movie) {
            //     if (err) {
            //         return res.status(403).json({success: false, message: "Unable to retrieve title passed in."});
            //     }
            //     if (movie && movie.length > 0) {
            //         return res.status(200).json({
            //             success: true,
            //             message: "Successfully retrieved movie.",
            //             movie: movie
            //         });
            //     } else {
            //         return res.status(404).json({
            //             success: false,
            //             message: "Unable to retrieve a match for title passed in."
            //         });
            //     }
            // })
            Movie.find(function(err, movies) {
                if (err) res.send(err);

                res.json(movies).status(200).end();
            })
        }
    })
    .all(function(req, res) {
        return res.status(403).json({success: false, message: "This HTTP method is not supported. Only GET, POST, PUT, and DELETE are supported."});
    });

router.route('/reviews')
    .post(authJwtController.isAuthenticated, function(req, res) {
        if (!req.body.small_quote || !req.body.rating || !req.body.title)
        {
            return res.json({ success: false, message: 'Please include all information for small quote, rating, and title to query.'});
        }
        else {
            var review = new Review();

            // retrieve authorization from authorization header and remove first 4 characters to get just the token
            jwt.verify(req.headers.authorization.substring(4), process.env.SECRET_KEY, function(err, ver_res) {
                if (err)
                {
                    return res.status(403).json({success: false, message: "Unable to post review passed in."});
                } else {
                    review.user_id = ver_res.id;

                    Movie.findOne({title: req.body.title}, function(err, movie) {
                        if (err) {
                            return res.status(403).json({success: false, message: "Unable to post review for title passed in"});
                        } else if (!movie) {
                            return res.status(403).json({success: false, message: "Unable to find title to post review for."});
                        } else {
                            review.movie_id = movie._id;
                            review.username = ver_res.username;
                            review.small_quote = req.body.small_quote;
                            review.rating = req.body.rating;

                            review.save (function (err) {
                                if (err) {
                                    return res.status(403).json({success: false, message: "Unable to post review for title passed in."});
                                } else {
                                    trackDimension(movie.genre, 'post/review', 'POST', review.rating, movie.title, '1');

                                    return res.status(200).json({success: true, message: "Successfully posted review for title passed in.", movie: movie});
                                }
                            })
                        }
                    })
                }
            })
        }
    })
    .all (function (req, res) {
        return res.status(403).json({success: false, message: "This HTTP method is not supported. Only POST is supported."});
    });

router.all('/', function (req, res) {
    return res.status(403).json({ success: false, msg: 'This route is not supported.' });
});

router.route('/test')
    .get(function (req, res) {
        // Event value must be numeric.
        trackDimension('Feedback', 'Rating', 'Feedback for Movie', '3', 'Guardian\'s of the Galaxy 2', '1')
            .then(function (response) {
                console.log(response.body);
                res.status(200).send('Event tracked.').end();
            })
    });

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only


