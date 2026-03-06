const crypto = require('crypto');
const axios = require('axios');  // Asegúrate de que axios esté en tus dependencias

function verifyShopifyWebhook(req, secret) {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  const body = JSON.stringify(req.body);
  const generatedHmac = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(Buffer.from(hmacHeader, 'utf8'), Buffer.from(generatedHmac, 'utf8'));
}

async function updateShopifyProduct(productId, apiKey, apiPassword, shop, token) {
  const url = `https://${apiKey}:${apiPassword}@${shop}/admin/api/2024-01/products/${productId}.json`;

  const updateData = {
    product: {
      id: productId,
      tags: "Price Zero", 
      status: "draft"
    }
  };

  try {
    const response = await axios.put(url, updateData, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json'
      }
    });
    console.log('Product updated successfully:', response.data);
  } catch (err) {
    console.log('Error updating product:', err);
  }
}

exports.handler = async (event) => {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiPassword = process.env.SHOPIFY_API_PASSWORD;
  const shop = process.env.SHOPIFY_SHOP_NAME;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;

  console.log('Function starting!');

  let body;
  console.log('event', event);
  console.log('event.body', event.body);
  try {
    body = JSON.parse(event.body);
    console.log('Body parsed: ', body);
  } catch (err) {
    console.log('Error parsing the body', err);
    return {
      statusCode: 400,
      body: 'Invalid body',
    };
  }

  /*   
  TODO: ESTABLISH WEBHOOK SECURITY
  if (!verifyShopifyWebhook(event, secret)) {
    console.log('Error verifyShopifyWebhook', secret);
    return {
      statusCode: 403,
      body: 'Invalid Shopify Webhook signature',
    };
  } 
  */

  const invalidVariants = body.variants.filter(variant => parseFloat(variant.price) === 0);

  if (invalidVariants.length > 0) {
    console.log(`Product with ID ${body.id} contains variants with price $0`);

    await updateShopifyProduct(body.id, apiKey, apiPassword, shop, token);

    return {
      statusCode: 400,
      body: 'Error: Product contains variants with price $0. Product updated to draft and tagged.',
    };
  }

  console.log(`Product with ID ${body.id} doesn't contain variants with price $0`);
  
  return {
    statusCode: 200,
    body: 'Product is valid',
  };
};
