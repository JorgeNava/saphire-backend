const axios = require('axios');

async function getTopSellingProductsGraphQL(shop, token) {
  const graphqlEndpoint = `https://${shop}/admin/api/2024-01/graphql.json`;

  let products = [];
  let hasNextPage = true;
  let afterCursor = null;

  try {
    console.log('Fetching closed orders using GraphQL...');

    while (hasNextPage) {
      const query = `
      {
        orders(first: 250, query: "status:closed", after: ${afterCursor ? `"${afterCursor}"` : null}) {
          edges {
            node {
              lineItems(first: 250) {
                edges {
                  node {
                    product {
                      id
                      title
                    }
                    quantity
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

      const response = await axios.post(
        graphqlEndpoint,
        { query },
        {
          headers: {
            'X-Shopify-Access-Token': token,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data.data.orders;
      const orders = data.edges;
      console.log(`Processed ${orders.length} orders. Has next page: ${data.pageInfo.hasNextPage}, End cursor: ${data.pageInfo.endCursor}`);

      orders.forEach((order) => {
        order.node.lineItems.edges.forEach((item) => {
          const { product, quantity } = item.node;
          if (!product || !quantity) return;

          const existingProduct = products.find((p) => p.id === product.id);
          if (existingProduct) {
            existingProduct.quantity += quantity;
          } else {
            products.push({
              id: product.id,
              title: product.title,
              quantity,
            });
          }
        });
      });

      hasNextPage = data.pageInfo.hasNextPage;
      afterCursor = data.pageInfo.endCursor;
    }

    console.log(`Total unique products processed: ${products.length}`);

    const sortedProducts = products
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return sortedProducts;
  } catch (err) {
    console.error('Error fetching orders with GraphQL:', err.message);
    throw new Error('Failed to fetch top-selling products using GraphQL');
  }
}

async function updateCollection(collectionId, topProducts, shop, token) {
  const baseUrl = `https://${shop}/admin/api/2024-01`;

  try {
    console.log(`Updating collection ID: ${collectionId} with top-selling products`);

    const collectsUrl = `${baseUrl}/collects.json?collection_id=${collectionId}`;
    const currentCollects = await axios.get(collectsUrl, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    });

    const currentCollectIds = currentCollects.data.collects.map((collect) => collect.id);
    for (const collectId of currentCollectIds) {
      await axios.delete(`${baseUrl}/collects/${collectId}.json`, {
        headers: {
          'X-Shopify-Access-Token': token,
        },
      });
    }

    for (const product of topProducts) {
      const numericProductId = product.id.split('/').pop();

      const addCollectData = {
        collect: {
          collection_id: collectionId,
          product_id: numericProductId,
        },
      };

      console.log('Adding product to collection:', addCollectData);

      await axios.post(`${baseUrl}/collects.json`, addCollectData, {
        headers: {
          'X-Shopify-Access-Token': token,
          'Content-Type': 'application/json',
        },
      });
    }

    console.log('Collection updated successfully with top products.');
  } catch (err) {
    console.error('Error updating collection:', err.message);
    throw new Error(`Failed to update collection: ${collectionId}`);
  }
}

exports.handler = async (event) => {
  const shop = process.env.SHOPIFY_SHOP_NAME;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  const collectionId = process.env.TOP_SELLING_COLLECTION_ID;

  try {
    const topProducts = await getTopSellingProductsGraphQL(shop, token);

    if (topProducts.length === 0) {
      console.warn('No top-selling products found to update the collection.');
      return {
        statusCode: 200,
        body: 'No top-selling products found.',
      };
    }

    await updateCollection(collectionId, topProducts, shop, token);

    return {
      statusCode: 200,
      body: 'Top-selling products updated successfully.',
    };
  } catch (err) {
    console.error('Error in Lambda function:', err.message);
    return {
      statusCode: 500,
      body: `An error occurred: ${err.message}`,
    };
  }
};
