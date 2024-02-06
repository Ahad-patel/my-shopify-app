import qrcode from "qrcode"
import invarient from "tiny-invarient"
import db from "../db.server"


export async function getQRCode(id,graphql) {
    const qrcode = await db.qRCode.findFirst({ where : { id }})

    if(!qrcode) {
        return null;
    }

    return supplimentQRCode(qrcode,graphql);

}



export async function getQRCodes (qrcode, graphql) {
    const qrcodes = await db.qRCode.findMany({
        where : { shop },
        orderBy : { id : "desc"}
    });

    if(qrcodes.length === 0) return [];

    return Promise.all(
        qrcodes.map((qrcode) => supplimentQRCode(qrcode, graphql))
    )
}

export function getQRCodeImage(id) {
    const url = new URL(`/qrcodes/${id}/scan`,
    process.env.SHOPIFY_APP_URL
    );

    return qrcode.toDataURL(url.href);
}

export function getDestinationUrl(qrcode) {
    if(qrcode.destination === "product") {
        return  `https://${qrcode.shop}/product/${qrcode.productHandle} `;
    }

    const match = /gid:\/\/shopify\/ProductVariant\/([0-9]+)/.exec(qrcode.productVarientId)
    invarient(match, "Unrecognized product varient Id");

    return `https://${qrcode.shop}/cart/${match[1]}:1`
}

async function supplimentQRCode(qrCode, graphql) {
    const qrcodeImagePromise = getQRCodeImage(qrCode.id);

    const response =  await graphql(
        `
         query supplimentQRCode($id: ID!) {
            product(id: $id) {
                title
                images(first: 1) {
                    nodes {
                        altText
                        url
                    }
                }
            }
         }
        `,
        {
            variables: {
                id: qrCode.productId
            }
        }
    );


    const {
        data: {product}
    } = await response.json();

    return {
        ...qrCode,
        productDeleted: !product?.title,
        productTitle: product?.title,
        productImage: product?.images?.nodes[0]?.url,
        productAlt: product?.images?.nodes[0]?.altText,
        destinationUrl: getDestinationUrl(qrCode),
        image: await qrcodeImagePromise,

    };
}


export function validateQRCode(data) {
    const errors = {};

    if(!data.title) {
        errors.title = "Title is Required";
    }

    if(!data.productId) {
        errors.productId = "Product Id is Required";
    }

    if(!data.destination) {
        errors.destination = "Destination is Required";
    }

    if(Object.keys(errors).length) {
        return errors;
    }
}

