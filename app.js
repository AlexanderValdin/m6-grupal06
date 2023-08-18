import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import {transporter} from './mailer.js';
import axios from 'axios';
import Joi from 'joi';
dotenv.config();

const app = express();
const port = 3200;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors()); 
app.use(express.static('public'));

const sendEmail = async (to, subject, message) => {

    const mailOptions = {
        from: process.env.MAIL_USER,
        to: to.join(', '),
        subject: subject,
        text: message
    };

    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                reject(error);
            } else {
                resolve(info.response);
            }
        });
    });
};

const fetchExchangeRates = async () => {
    try {
        const response = await axios.get('https://mindicador.cl/api');
        const { dolar, euro, uf, utm } = response.data;
        return `Tasa de cambio:\nDólar: ${dolar.valor}\nEuro: ${euro.valor}\nUF: ${uf.valor}\nUTM: ${utm.valor}`;
    } catch (error) {
        throw error;
    }
};

const formSchema = Joi.object({
    correos: Joi.string().required(),
    asunto: Joi.string().required(),
    mensaje: Joi.string().required()
});

app.post('/enviar-correo', async (req, res) => {
    const { correos, asunto, mensaje } = req.body;
    const listaCorreos = correos.split(',').map(correo => correo.trim());

    const correosSchema = Joi.array().items(Joi.string().email());

    const { error: correosError } = correosSchema.validate(listaCorreos);
    if (correosError) {
        return res.status(400).send('Por favor, ingresa direcciones de correo válidas.');
    }
    
    const { error: formError } = formSchema.validate({ correos, asunto, mensaje });

    if (formError) {
        return res.status(400).send(formError.details[0].message);
    }

    try {
        const exchangeRates = await fetchExchangeRates();
        const fullMessage = `${mensaje}\n\n${exchangeRates}`;
        await sendEmail(listaCorreos, asunto, fullMessage);

        // Almacenar correos como archivos con nombres únicos
        const emailId = uuidv4();
        listaCorreos.forEach(async (correo) => {
            const fileName = `./correos/${emailId}-${correo}.txt`;
            await fs.promises.writeFile(fileName, fullMessage);
            console.log(correos, asunto, mensaje);
        });
        console.log('Correo enviado exitosamente');
        res.redirect('/');
    } catch (error) {
        console.error('Error al enviar el correo:', error);
        res.status(500).send('Error al enviar el correo.');
    }
});

app.listen(port, (req,res)=> {
    console.log(`Servidor corriendo en el puerto ${port}`);
});
