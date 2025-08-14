const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config(); // THIS MUST BE THE FIRST LINE AFTER IMPORTS

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: [
        "http://localhost:5173",
    ],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const verifytoken = (req, res, next) => {
    const token = req?.cookies?.token;
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access' });
        }
        req.user = decoded;
        next();
    });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ejjba9r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        const cuisinecollection = client.db('NobabDine').collection('AllCuisins');
        const cartcollection = client.db('NobabDine').collection('AllCarts');
        const ordercollection = client.db('NobabDine').collection('orders');

        // All Cuisines
        app.get('/topcuisin', async (req, res) => {
            const result = await cuisinecollection.find().sort({ purchase_count: -1 }).limit(6).toArray();
            res.send(result);
        });

        app.get('/allcuisin', async (req, res) => {
            const search = req.query.search || "";
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 9;
            const skip = (page - 1) * limit;
            const query = search ? {
                $or: [
                    { name: { $regex: search, $options: "i" } },
                    { category: { $regex: search, $options: 'i' } },
                    { origin: { $regex: search, $options: "i" } }
                ]
            } : {};
            const totalitem = await cuisinecollection.countDocuments(query);
            const totalpage = Math.ceil(totalitem / limit);
            const foods = await cuisinecollection.find(query).skip(skip).limit(limit).toArray();
            res.send({ foods, totalpage });
        });

        app.delete('/allcuisin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cuisinecollection.deleteOne(query);
            res.send(result);
        });

        app.put('/allcuisin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updatedCuisine = req.body;
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    name: updatedCuisine.name,
                    image: updatedCuisine.image,
                    category: updatedCuisine.category,
                    quantity: updatedCuisine.quantity,
                    price: updatedCuisine.price,
                    origin: updatedCuisine.origin,
                    description: updatedCuisine.description,
                    chef: updatedCuisine.chef,
                },
            };
            const result = await cuisinecollection.updateOne(query, updateDoc, options);
            res.send(result);
        });

        app.get('/mycuisin',verifytoken, async (req, res) => {
            const email = req.query.email;
            if(req.user.email !==email){
                return res.status(403).send({message:'forbidden access'})
            }
            const query = { email: email };
            const result = await cuisinecollection.find(query).toArray();
            res.send(result);
        });

        app.get('/allcuisin/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cuisinecollection.findOne(query);
            res.send(result);
        });

        app.post('/allcuisin', async (req, res) => {
            const newitem = req.body;
            const result = await cuisinecollection.insertOne(newitem);
            res.send(result);
        });

        // Carts
        app.post('/carts', async (req, res) => {
            const newcart = req.body;
            const result = await cartcollection.insertOne(newcart);
            res.send(result);
        });

        app.get('/carts', verifytoken, async (req, res) => {
            const email = req.query.email;
            if (req.user.email !== email) {
        return res.status(403).send({ message: 'forbidden access' });
    }
            const query = { email: email };
            const result = await cartcollection.find(query).toArray();
            res.send(result);
        });

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartcollection.deleteOne(query);
            res.send(result);
        });

        // Orders
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
                await cartcollection.deleteMany({ email: userEmail });
            }
            res.send(orderResult);
        });

        app.get('/orders',verifytoken, async (req, res) => {
            const email = req.query.email;
            if (req.user.email !== email) {
        return res.status(403).send({ message: 'forbidden access' });
    }
            const query = { userEmail: email };
            const result = await ordercollection.find(query).toArray();
            res.send(result);
        });

        // Auth related
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '5h' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            });
            res.send({ success: true });
        });

        app.post('/logout', async (req, res) => {
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "strict"
            });
            res.send({ success: true });
        });
    } finally {
        app.get('/', (req, res) => {
            res.send('Hello My World !');
        });

        app.listen(port, () => {
            console.log(`app listening on port ${port}`);
        });
    }
}
run().catch(console.dir);
