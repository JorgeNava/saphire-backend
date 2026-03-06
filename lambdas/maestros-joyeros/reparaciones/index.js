const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  const method = event.httpMethod || event.requestContext?.http?.method;

  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (method !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: 'Method Not Allowed'
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: 'Invalid JSON'
    };
  }

  const { orderNumber, name, phone, email, sucursal, message } = body;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  transporter.verify(function(error, success) {
    if (error) {
      console.log('Error de conexión:', error);
    } else {
      console.log('Conexión exitosa, listo para enviar correos');
    }
  });

  const mailOptions = {
    from: `"Formulario Reparaciones" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Nueva solicitud de reparación',
    bcc: process.env.SMTP_USER,
    html: `
      <h3>Solicitud de reparación</h3>
      <p><strong>Número de orden:</strong> ${orderNumber}</p>
      <p><strong>Nombre:</strong> ${name}</p>
      <p><strong>Teléfono:</strong> ${phone}</p>
      <p><strong>Correo:</strong> ${email}</p>
      <p><strong>Sucursal:</strong> ${sucursal}</p>
      <p><strong>Mensaje:</strong> ${message}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return {
      statusCode: 200,
      headers,
      body: 'Correo enviado con éxito'
    };
  } catch (err) {
    console.error('Error enviando correo:', err);
    return {
      statusCode: 500,
      headers,
      body: 'Error al enviar el correo'
    };
  }
};
