import mongoose from 'mongoose';
let connection:Promise<typeof mongoose>|undefined;
export async function db(){const uri=process.env.MONGODB_URI;if(!uri)throw new Error('MONGODB_URI is missing');connection??=mongoose.connect(uri).catch(e=>{connection=undefined;throw e});return connection;}
