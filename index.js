const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;
//middleware
app.use(cors({
    origin:[
        "http://localhost:5173",
    ],
    credentials:true
}))
app.use(express.json())
app.use(cookieParser())
app.get('/', (req, res) => {
  res.send('Hello My World !')
})

app.listen(port, () => {
  console.log(`app listening on port ${port}`)
})
