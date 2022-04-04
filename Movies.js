var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

mongoose.Promise = global.Promise;

//mongoose.connect(process.env.DB, { useNewUrlParser: true });
try {
    mongoose.connect( process.env.DB, {useNewUrlParser: true, useUnifiedTopology: true}, () =>
        console.log("connected"));
}catch (error) {
    console.log("could not connect");
}
mongoose.set('useCreateIndex', true);

//movie schema
var MovieSchema = new Schema({
    title: { type: String, required: true, index: {unique: true }},
    year_released: { type: String, required: true},
    genre:
        {
            type: String,
            required: true,
            enum: ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Thriller", "Western"]
        },
    actors:
        [
            { actor_name: { type: String, required: true}, character_name: { type: String, required: true}},
            { actor_name: { type: String, required: true}, character_name: { type: String, required: true}},
            { actor_name: { type: String, required: true}, character_name: { type: String, required: true}}
        ],
    imageUrl: { type: String }
});

MovieSchema.pre('save', function(next) {
    next();
});

//return the model to server
module.exports = mongoose.model('Movie', MovieSchema);