const express = require('express');
require('dotenv').config();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { ObjectID } = require('bson');
const { query } = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dhuzavj.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const toolsCollection = client.db('emarat_manufacturer').collection('tools');
        const reviewsCollection = client.db('emarat_manufacturer').collection('reviews');
        const userCollection = client.db('emarat_manufacturer').collection('users');
        const orderCollection = client.db('emarat_manufacturer').collection('orders');
        const paymentCollection = client.db('emarat_manufacturer').collection('payments');

        // tools get api
        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolsCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        });

        // tools post api 
        app.post('/tool', async (req, res) => {
            const newProduct = req.body;
            const result = await toolsCollection.insertOne(newProduct);
            res.send(result);
        });
        //load single tools get api
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectID(id) };
            const tools = await toolsCollection.findOne(query);
            res.send(tools);
        });

        // delete tools api 
        app.delete('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await toolsCollection.deleteOne(query);
            res.send(result);
        });

        // reviews get api
        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = reviewsCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews);
        });

        // add review post api
        app.post('/review', async (req, res) => {
            const newReview = req.body;
            const result = await reviewsCollection.insertOne(newReview);
            res.send(result);
        });

        // order post api 
        app.post('/order', async (req, res) => {
            const order = req.body;
            const result = await orderCollection.insertOne(order);
            res.send(result);
        });

        // order get api 
        app.get('/order', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email: email };
                const orders = await orderCollection.find(query).toArray();
                res.send(orders);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }

        });

        // single order get api 
        app.get('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.send(order);
        });

        // manage order get api 
        app.get('/orders', async (req, res) => {
            const query = {};
            const cursor = orderCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders);
        });

        // payment intent api 
        app.post('/create-payment-intent', async (req, res) => {
            const orders = req.body;
            if (orders.price) {
                const price = orders.price;
                const amount = price * 100;
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ['card']
                });
                res.send({ clientSecret: paymentIntent.client_secret })
            }
        });

        // updated order api 
        app.patch('/order/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
            res.send(updatedOrder);
        });

        // cancel order api 
        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            res.send(result);
        });

        // get all user api 
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });


        // user put api
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        });

        // admin api 
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                const filter = { email: email }
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result);
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }

        });

        // order shipped api 
        app.put('/orders/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: { status: 'shipped' },
            };
            const result = await orderCollection.updateOne(filter, updateDoc);
            res.send(result);


        });

        // admin get api 
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        // get sigle user api
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const users = await userCollection.findOne(query);
            res.send(users);
        });



    }
    finally {

    }

}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello!')
})

app.listen(port, () => {
    console.log(`listening on port ${port}`)
})