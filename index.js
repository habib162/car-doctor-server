const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
    origin: [
        'http://127.0.0.1:5173'
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.6nq2qod.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// middlewares
const logger = (req, res, next) => {
    console.log('log: info',req.method, req.url);
    next();
}
const verifyToken = (req, res, next) =>{
    const token = req?.cookies?.token;
    if (!token) {
        return res.status(401).send({message : 'unauthorized access'})
    }
    jwt.verify(token, process.env.ACCESS_TOKEN,(err,decoded) =>{
        if (err) {
            return res.status(401).send({message : 'unauthorized access'})
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const serviceCollection = client.db('carDoctorDB').collection('services');
        const checkoutCollection = client.db('carDoctorDB').collection('checkouts');

        // auth api
        app.post('/jwt',async(req,res) =>{
            const user = req.body;
            console.log('user for token',user);
            const token = jwt.sign(user,process.env.ACCESS_TOKEN, {expiresIn:'1h'})

            res.cookie('token', token,
            {
                httpOnly: true,
                secure: true,
                sameSite : 'none'

            })
            .send({success: true});
        })

        app.post('/logout',async(req,res)=>{
            const user = req.body;
            res.clearCookie('token',{maxAge: 0}).send({success: true})
        })
        
        
        // services api
        app.get('/services',async (req, res) => {
            const cursor = serviceCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })
        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            // const options = {
            //     projections : {title: 1, price: 1, service_id: 1, img: 1},
            // }
            // const result = await serviceCollection.findOne(query,options);
            const result = await serviceCollection.findOne(query);
            res.send(result);
        })


        // checkout
        app.post('/checkouts',async (req, res) => {
            const checkout = req.body;
            const result = await checkoutCollection.insertOne(checkout);
            res.send(result);
        }) 

        app.get('/checkouts', verifyToken, async(req,res) =>{

            console.log('user',req.query.email);
            console.log('owner',req.decoded.email);
            // console.log('cokies', req.cookies);
            if (req.decoded.email !== req.query.email) {
                return res.status(403).send({message: 'forbidden access'})
            }
            let query = {};
            if (req.query?.email) {
                query = {email: req.query.email}
            }
            const result = await checkoutCollection.find().toArray();
            res.send(result);
        })

        app.delete('/checkouts/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await checkoutCollection.deleteOne(query);
            res.send(result);
        })
        app.put('/checkouts/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const updateBooking = req.body;
            const updateDoc = {
                $set : {
                    status : updateBooking.status
                }
            };
            const result = await checkoutCollection.updateOne(query, updateDoc)
            res.send(result)
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('car doctor is running')
})

app.listen(port, () => {
    console.log(`car doctor server is running on port ${port}`);
})