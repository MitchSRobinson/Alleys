// Imports
const bodyParser    = require( "body-parser" );
const express       = require( "express" );
const fetch         = require( "node-fetch" );
const fs            = require( "fs" );
const https         = require( "https" );
const mongodb       = require( "mongodb" );
const spdy          = require( "spdy" );

// Config Setup
const MongoClient   = mongodb.MongoClient;
const Server        = mongodb.Server;
const app           = express();

app.use( bodyParser.json() );

// Variables
const DATABASE_IP   = process.env.DATABASE_IP || 'localhost';
const AUTH_IP       = process.env.AUTH_IP || 'localhost';
const DATABASE      = 'roster';
const USER_COL      = 'drivers';
const PORT          = 8202;

// Authenticate the driver.
async function isAuthenticated( req, username ) {
    return await fetch(`https://${AUTH_IP}:8201/session`, {
        headers: { 'x-auth': req.headers[ 'x-auth' ]},
        key: fs.readFileSync('cert/key.pem'),
        cert: fs.readFileSync('cert/cert.pem'),
        agent: new https.Agent({
            rejectUnauthorized: false,
        }),
    })
    .then(async res => {
        let uid = await res.json();
        if (res.ok && uid['username'] == username) {
            return true;
        }
        return false;
    })
    .catch(err => {
        console.log(err);
        return false;
    });
}

// Join the roster by username and price.
app.put( '/:username', async ( req, res ) => {
    try {
        const username  = req.params.username;
        const price      = req.body['price'];

        authenticated = await isAuthenticated(req, username);
        if (!authenticated) {
            res.status( 401 ).end();
            return;
        }

        const svr       = new Server( DATABASE_IP, 27017 );
        const con       = await MongoClient.connect( svr );
        const col       = con.db( DATABASE ).collection( USER_COL );
        const result    = await col.updateOne(
            { username : username },
            { $set : {
                price : price
            }},
            { upsert : true }
        );
        con.close();
        console.log(`Successfully added ${username} to the roster at ${price}p/km.`);
        res.status( 204 ).end(); // 204 = No Content
    } catch ( e ) {
        console.log(`Error handling the users request - returning 500.`)
        console.log(e);
        res.status( 500 ).end(); // 500 = Internal Server Error
    }
});

// Get driver price.
app.get( '/:username', async ( req, res ) => {
    try {
        const username  = req.params.username;
        
        const svr       = new Server( DATABASE_IP, 27017 );
        const con       = await MongoClient.connect( svr );
        const col       = con.db( DATABASE ).collection( USER_COL );
        const doc       = await col.findOne( { username: username } );
        con.close();

        if ( doc ) {
            res.status( 200 ).json( { price: doc.price } ).end(); // 200 = OK
        } else {
            res.status( 404 ).end(); // 404 = Not Found
        }
    } catch ( e ) {
        console.log(`Error handling the users request - returning 500.`)
        console.log(e);
        res.status( 500 ).end(); // 500 = Internal Server Error
    }
});

// Get a list of all drivers currently on the roster.
app.get( '/', async ( req, res ) => {
    try {
        let drivers = [];
        
        const svr       = new Server( DATABASE_IP, 27017 );
        const con       = await MongoClient.connect( svr );
        const col       = con.db( DATABASE ).collection( USER_COL );
        const docs      = col.find().sort({price: 1});

        for (let doc = await docs.next(); doc != null; doc = await docs.next()) {
            drivers.push( { driver: doc.username, price: doc.price } );
        }

        con.close();
        console.log(`Returning ${drivers.length} drivers from the roster.`);
        res.status( 200 ).json( drivers ).end(); // 200 = OK
    } catch ( e ) {
        console.log(`Error handling the users request - returning 500.`)
        console.log(e);
        res.status( 500 ).end(); // 500 = Internal Server Error
    }
});

// Remove a driver from the roster.
app.delete( '/:username', async (req, res) => {
    try {
        const username = req.params.username;

        authenticated = await isAuthenticated(req, username);
        if (!authenticated) {
            res.status( 401 ).end();
            return;
        }
        
        const svr       = new Server( DATABASE_IP, 27017 );
        const con       = await MongoClient.connect( svr );
        const col       = con.db( DATABASE ).collection( USER_COL );
        const doc       = col.deleteOne( { username: username }, (err, obj) => {
            if (err) throw err;
            console.log(`User ${username} has removed themself from the roster.`)
            res.status( 204 ).end(); // 204 = No Content
        });
    } catch ( e ) {
        console.log(`Error handling the users request - returning 500.`)
        console.log(e);
        res.status( 500 ).end(); // 500 = Internal Server Error
    }
});

// Create and run HTTPS server.
const server = spdy.createServer( {
    key : fs.readFileSync( "./cert/key.pem" ),
    cert : fs.readFileSync( "./cert/cert.pem" )
}, app );

server.listen( PORT, () => {
    console.log( `Roster server listening on port ${PORT}...` )
});