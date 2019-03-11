// Imports
const bcrypt = require( "bcryptjs" );
const bodyParser = require( "body-parser" );
const express = require( "express" );
const fs = require( "fs" );
const jwt = require( "jwt-simple" );
const mongodb = require( "mongodb" );
const spdy = require( "spdy" );

// Config Setup
const MongoClient = mongodb.MongoClient;
const Server = mongodb.Server;
const app = express();
app.use( bodyParser.json() );

// Variables
const DATABASE_IP   = process.env.AUTH_IP;
const SECRET        = 'secretKey';
const DATABASE      = 'auth';
const USER_COL      = 'users';
const PORT          = '8201';

// Register a drivers details in the auth mongo database.
// Test Command - curl -i -X POST -H "Content-Type: application/json" --data "{ \"username\":\"bart\", \"password\":\"muppet\" }" http://localhost:8201/register
app.post( '/register', async (req, res) => {
    try {
        const u = req.body.username;
        const p = req.body.password;

        if (!u && !p) {
            res.status( 403 ).send( "Must provide a username and password." ); // 403 = Forbidden
        }

        const h = await bcrypt.hashSync(p, 10);
        const svr = new Server( DATABASE_IP, 27017 );
        const con = await MongoClient.connect( svr );
        const col = con.db( DATABASE ).collection( USER_COL );
        
        await col.updateOne(
            { username : u },
            { $set : { password : h } },
            { upsert : true }
        );

        con.close();

        console.log(`User "${u}" has created/updated their driver profile...`);
        res.status( 204 ).end(); // 204 = No Content
    } catch ( e ) {
        console.log(`Error handling the users request - returning 500.`)
        console.log(e);
        res.status( 500 ).end(); // 500 = Internal Server Error
    }
});

// Get the drivers token (used to access the roster).
// Test Command - curl -i -X POST -H "Content-Type: application/json" --data "{ \"password\":\"muppet\" }" http://localhost:8443/token/bart
app.post( '/token/:username', async (req, res) => {
    try {
        const u = req.params.username;
        const p = req.body.password;

        const svr = new Server( DATABASE_IP, 27017 );
        const con = await MongoClient.connect( svr );
        const col = con.db( DATABASE ).collection( USER_COL );
        
        const doc = await col.findOne( { username: u } );

        con.close();
        if ( doc ) {
            const vld = await bcrypt.compareSync( p, doc.password );
            if ( vld ) {
                const uid = { username: u };
                const tkn = jwt.encode( uid, SECRET );
                console.log(`User "${u}" has logged in...`);
                res.status( 200 ).json( tkn ).end(); // 200 = OK
            } else {
                console.log(`Unsuccessful login attempt - returning 401.`);
                res.status( 401 ).end(); // 401 = Unauthorised
            }
        } else {
            console.log(`Unsuccessful login attempt - returning 401.`);
            res.status( 401 ).end(); // 401 = Unauthorised
        }
    } catch ( e ) {
        console.log(`Error handling the users request - returning 500.`)
        console.log(e);
        res.status( 500 ).end(); // 500 = Internal Server Error
    }
});

// Verify a users token.
// Test Command -  curl -i -X GET -H "x-auth:{{TOKEN}}" http://localhost:8443/session
app.get('/session', async (req, res) => {
    try {
        const token = req.headers[ 'x-auth' ];
        const uid = jwt.decode( token, SECRET );
        console.log(`User "${uid['username']}" successfully verified their session.`)
        res.status( 200 ).json( uid ).end();
    } catch ( e ) {
        console.log(`Unsuccessful session validation attempt - returning 401.`);
        res.status( 401 ).end(); // 401 = Unauthorised
    }
});

// Create and run HTTPS server.
const server = spdy.createServer( {
    key : fs.readFileSync( "cert/key.pem" ),
    cert : fs.readFileSync( "cert/cert.pem" )
}, app );

server.listen( PORT, () => {
    console.log( `Auth server listening on port ${PORT}...` );
});
