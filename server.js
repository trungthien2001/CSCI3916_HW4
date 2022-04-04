/*
CSCI3916_HW3
Name: Thien Nguyen
File: Server.js
Description: Web API scaffolding for Movie API
 */

const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const authJwtController = require('./auth_jwt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const User = require('./Users');
const Movie = require("./Movies");
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(passport.initialize());
const router = express.Router();

function getJSONObjectForMovieRequirement(req, msg)
{
    let json =
        {
        message: msg,
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null)
    {
        json.body = req.body;
    }

    if (req.headers != null)
    {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function (req, res)
{
    if (!req.body.username || !req.body.password)
    {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    }
    else
    {
        let user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;
        user.save(function (err)
        {
            if (err)
            {
                if (err.code === 11000)
                    return res.json({success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }
            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin', function (req, res)
{
    let userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;
    User.findOne({username: userNew.username}).select('name username password').exec(function (err, user)
    {
        if (err)
        {
            res.send(err);
        }
        user.comparePassword(userNew.password, function (isMatch)
        {
            if (isMatch)
            {
                let userToken = {id: user.id, username: user.username};
                let token = jwt.sign(userToken, process.env.SECRET_KEY, null, null);
                res.json({success: true, token: 'JWT ' + token});
            } else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

router.route('/movies')
    .get(authJwtController.isAuthenticated, function (req, res)
    {
        console.log(req.body);
        res = res.status(200);
        if (req.get('Content-Type'))
        {
            res = res.type(req.get('Content-Type'));
        }
        Movie.find().exec(function (err, movies)
        {
            if (err)
            {
                res.send(err);
            }
            if (movies.length < 1)
            {
                res.json({success: false, message: 'No movies found.'});
            }
            else
            {
                res.json(movies);
            }
        })
    })

    .post(authJwtController.isAuthenticated, function (req, res)
    {
        console.log(req.body);
        res = res.status(200);
        const genres =
            ["Action",
            "Adventure",
            "Comedy",
            "Drama",
            "Fantasy",
            "Horror",
            "Mystery",
            "Thriller"];
        if(!req.body.title){res.json({success: false, message: "Title Missing, Please add the Title of the Movie"});}
        else if (!req.body.genre)
        {
            res.json({success: false, message: 'Genre Missing, Please add Genre of the Movie.'})
        }
        else if (!genres.includes(req.body.genre))
        {
            res.json({success: false, message: "Genre Missing, Please add Genre of the Movie.", accepted_genres: genres})
        }
        else if (req.body.yearReleased.length < 4)
        {
            res.json({success: false, message: 'Release Year Missing, Please add the Release Year of the Movie or Please add 4 digits for Release Year.'})
        }
        else if (req.body.actors.length < 3)
        {
            res.json({success: false, message: 'Actors Missing, Please add at least 3 actors of the Movie.'})
        }
        else {
            let movieNew = new Movie();
            movieNew.title = req.body.title;
            movieNew.yearReleased = req.body.yearReleased;
            movieNew.genre = req.body.genre;
            movieNew.actors = req.body.actors;

            if (req.get('Content-Type'))
            {
                res = res.type(req.get('Content-Type'));
            }

            movieNew.save(function (err)
            {
                if (err) {
                    if (err.code === 11000)
                        return res.json({success: false, message: 'This Movie already exists.'});
                    else
                        return res.json(err);
                } else {
                    var o = getJSONObjectForMovieRequirement(req, 'Movie has been saved');
                    res.json(o)
                }
            });
        }
    })



router.route('/movies/:title')
    .get(authJwtController.isAuthenticated, function (req, res)
    {
        console.log(req.body);
        res = res.status(200);

        if (req.get('Content-Type'))
        {
            res = res.type(req.get('Content-Type'));
        }
        Movie.find({title: req.params.title}).exec(function (err, movie)
        {
            if (err)
            {
                res.send(err);
            }
            res.json(movie);
        })
    })
    .delete(authJwtController.isAuthenticated, function (req, res)
    {
        console.log(req.body);
        res = res.status(200);
        if (req.get('Content-Type'))
        {
            res = res.type(req.get('Content-Type'));
        }
        Movie.find({title: req.params.title}).exec(function (err, movie) {
            if (err)
            {
                res.send(err);
            }
            console.log(movie);
            if (movie.length < 1)
            {
                res.json({success: false, message: 'The Movie Title you entered could not be found.'});
            } else
            {
                Movie.deleteOne({title: req.params.title}).exec(function (err)
                {
                    if (err)
                    {
                        res.send(err);
                    } else
                    {
                        var o = getJSONObjectForMovieRequirement(req, 'Movie has been deleted');
                        res.json(o);
                    }
                })
            }
        })
    })
    .put(authJwtController.isAuthenticated, function (req, res)
    {
        console.log(req.body);
        res = res.status(200);
        if (req.get('Content-Type'))
        {
            res = res.type(req.get('Content-Type'));
        }
        Movie.updateOne({title: req.params.title},
            {
            title: req.body.title,
            yearReleased: req.body.yearReleased, genre: req.body.genre, actors: req.body.actors
        })
            .exec(function (err)
            {
                if (err)
                {
                    res.send(err);
                }
            })
        var o = getJSONObjectForMovieRequirement(req, 'Movie has been updated');
        res.json(o);
    });


app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only
