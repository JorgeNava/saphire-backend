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

  const { name, email, phone, sucursal, fecha, hora } = body;

  const destinatarios = {
    masaryk: 'juancarlosmasaryk@maestrosjoyeros.com',
    lobby_33: 'francisco.bernal@maestrosjoyeros.com',
    distrito_joyero: 'fabiola.cardenas@maestrosjoyeros.com',
    piso_14: 'info@maestrosjoyeros.com'
  };

  const correoDestino = destinatarios[sucursal];

  if (!correoDestino) {
    return {
      statusCode: 400,
      headers,
      body: 'Sucursal inválida o no configurada'
    };
  }

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
    from: `"Formulario Agenda tu cita" <${process.env.SMTP_USER}>`,
    //to: correoDestino,
    to: "jorgenavadelapena@gmail.com",
    subject: `Nueva cita agendada - ${sucursal.replace('_', ' ')}`,
    bcc: process.env.SMTP_USER,
    html: `
      <h3>Agendamiento de cita</h3>
      <p><strong>Nombre:</strong> ${name}</p>
      <p><strong>Correo:</strong> ${email}</p>
      <p><strong>Teléfono:</strong> ${phone}</p>
      <p><strong>Sucursal:</strong> ${sucursal.replace('_', ' ')}</p>
      <p><strong>Fecha:</strong> ${fecha}</p>
      <p><strong>Hora:</strong> ${hora}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return {
      statusCode: 200,
      headers,
      body: 'Cita agendada con éxito'
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
