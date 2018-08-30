const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )
const User = mongoose.model('User', { username: {type:     String, 
                                                 unique:   true, 
                                                 required: true, 
                                                 dropDups: true} });
const Exercise = mongoose.model('Exercise', { userId:      {type: String, required: true},
                                              description: {type: String, required: true},
                                              duration:    {type: Number, required: true},
                                              date:        {type: Date}
                                            });

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
})

app.post('/api/exercise/new-user', (req, res, next) => {
  const newUser = new User(req.body)
  newUser.save((err, data) => {
    if (err) return next({message: 'username already taken'})
    res.json({username: data.username, _id: data._id})
  })
})

app.post('/api/exercise/add', (req, res, next) => {
  User.findById(req.body.userId, (err, user) => {
    if (err) return next(err)
    if (!user) return next({message: 'unknown userId'})
    const exercise = new Exercise(req.body)
    if (!exercise.date) exercise.date = Date.now()
    exercise.save((err, data) => {
      if (err) return next(err)
      res.json({username:    user.username,
                userId:      data.userId,
                description: data.description,
                duration:    data.duration,
                date:        (new Date(data.date)).toDateString()})
    })
  })
})

app.get('/api/exercise/log', (req, res, next) => {
  User.findById(req.query.userId, (err, user) => {
    if (err) return next(err)
    if (!user) return next({message: 'unknown userId'})
    Exercise.find({userId: user._id,
                   date: { $gt: req.query.from ? new Date(req.query.from) : 0,
                           $lt: req.query.to ? new Date(req.query.to) : Date.now() }
                  })
    .sort('-date')
    .limit(Number(req.query.limit))
    .exec((err, data) => {
      if (err) return next(err)
      res.json({_id:         user._id,
                username:    user.username,
                count:       data.length,
                log:         data.map(d => ({description: d.description, 
                                             duration: d.duration, 
                                             date: (new Date(d.date)).toDateString()}) )
      })
    })
  })
})


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
