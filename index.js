const express = require('express');
require('dotenv').config();
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { ObjectID } = require('bson');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dhuzavj.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

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
        //load single tools get api
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectID(id) };
            const tools = await toolsCollection.findOne(query);
            res.send(tools);
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
        app.get('/order', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const orders = await orderCollection.find(query).toArray();
            res.send(orders);
        });

        // single order get api 
        app.get('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.send(order);
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
            res.send(result);
        });

        // get sigle user api
        app.get('/user', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const users = await userCollection.find(query).toArray();
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