const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;
//middleware
app.use(cors({
    origin: [
        "http://localhost:5173",
    ],
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ejjba9r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server (optional starting in v4.7)
        await client.connect();
        const cuisinecollection = client.db('NobabDine').collection('AllCuisins')
        const cartcollection = client.db('NobabDine').collection('AllCarts')
        const ordercollection = client.db('NobabDine').collection('orders');

        app.get('/topcuisin', async (req, res) => {
            const result = await cuisinecollection.aggregate([{$sort:{purchase_count:-1}},{$limit:6}]).toArray();
            res.send(result)
        })
        app.get('/allcuisin', async (req, res) => {
            const result = await cuisinecollection.find().toArray();
            res.send(result)
        })
        app.delete('/allcuisin/:id',async(req,res)=>{
            const id=req.params.id;
            const query={_id:new ObjectId(id)};
            const result=await cuisinecollection.deleteOne(query);
            res.send(result)
        })
        app.put('/allcuisin/:id',async(req,res)=>{
            const id=req.params.id;
            const query={_id:new ObjectId(id)};
            const updatedCuisine=req.body;
            const options = { upsert: true };
            const updateDoc = {
      $set: {
          name:updatedCuisine.name,
          image:updatedCuisine.image,
           category: updatedCuisine.category,
            quantity: updatedCuisine.quantity,
            price: updatedCuisine.price,
            origin: updatedCuisine.origin,
            description: updatedCuisine.description,
            chef: updatedCuisine.chef,
      },
    };
            const result=await cuisinecollection.updateOne(query,updateDoc,options);
            res.send(result)
        })
        app.get('/mycuisin',async(req,res)=>{
            const email=req.query.email;
            const query={email : email};
            const result=await cuisinecollection.find(query).toArray();
            res.send(result)
        })
        app.get('/allcuisin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cuisinecollection.findOne(query);
            res.send(result)
        })
        app.post('/allcuisin', async (req, res) => {
            const newitem = req.body;
            const result = await cuisinecollection.insertOne(newitem)
            res.send(result)
        })
        //carts
        app.post('/carts', async (req, res) => {
            const newcart = req.body;
            const result = await cartcollection.insertOne(newcart)
            res.send(result);
        })
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await cartcollection.find(query).toArray();
            res.send(result);
        })
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartcollection.deleteOne(query);
            res.send(result);
        })

        // Orders related
        app.post('/orders', async (req, res) => {
            const order = req.body;
            const orderItems = order.items;
            const userEmail = order.userEmail;
            const orderResult = await ordercollection.insertOne(order);
            if (orderResult.insertedId) {
                for (const item of orderItems) {
                    const cuisineId = item.cuisineId;
                    const quantityOrdered = item.inputqty;

                    const filter = { _id: new ObjectId(cuisineId) };
                    const updateDoc = {
                        $inc: {
                            quantity: -quantityOrdered,
                            purchase_count: quantityOrdered,
                        },
                    };
                    await cuisinecollection.updateOne(filter, updateDoc);
                }

                // After updating cuisine, clear the user's cart
                await cartcollection.deleteMany({ email: userEmail });
            }

            res.send(orderResult);
        });

        app.get('/orders', async (req, res) => {
            const email = req.query.email;
            const query = { userEmail: email };
            const result = await ordercollection.find(query).toArray();
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        app.get('/', (req, res) => {
            res.send('Hello My World !')
        })
        
        app.listen(port, () => {
            console.log(`app listening on port ${port}`)
        })
    }
}
run().catch(console.dir);