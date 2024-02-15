import { useState } from "react";
import { json, redirect } from "@remix-run/node";
import { userActionData, useLoaderData, useNavigation, useSubmit, useNavigates, useNavigate } from "@remix-run/react"
import { authenticate } from "../shopify.server"

import db from "..db.server"
import { getQRCode, validateQRCode } from "../models/QRCode.server";
import {
    Card,
    Bleed,
    Button,
    ChoiceList,
    Divider,
    EmptyState,
    InlineStack,
    InlineError,
    Layout,
    Page,
    Text,
    TextField,
    Thumbnail,
    BlockStack,
    PageActions,
} from "@shopify/polaris";

export async function loader({ request, params }) {
    const { admin } = await authenticate.admin(request);

    if (params.id === "new") {
        return json({
            destination: "product",
            title: ""
        });
    }
    return json(await getQRCode(Number(params.id), admin.graphql));
}

export async function action({ request, params }) {
    const { session } = await authenticate.admin(request);
    const { shop } = session;

    /** @type {any} */
    const data = {
        ...Object.fromEntries(await request.formData()),
        shop
    }

    if (data.action === "delete") {
        await db.qrCode.delete({ where: { id: Number(params.id) } });
        return redirect("/app");
    }

    const errors = validateQRCode(data);

    if (errors) {
        return json({ errors }, { status: 422 });
    }

    const qrCode =
        params.id === "new"
            ? await db.qrCode.create({ data })
            : await db.qrCode.update({ where: { id: Number(params.id) }, data });

    return redirect(`/app/qrcodes/${qrCode.id}`);

}


export default function QRCodeForm() {
    const errors = userActionData()?.errors || {};

    const qrCode = useLoaderData();

    const [formState, setFormSate] = useState(qrCode);
    const [cleanFormState, setCleanFormState] = useState(qrCode);

    const isDirty = JSON.stringify(formState) !== JSON.stringify(cleanFormState);

    const nav = useNavigation();

    const isSaving =
        nav.state === "submitting" && nav.formData?.get("action") !== "delete"

    const isDeleting =
        nav.state === "submitting" && nav.formData?.get("action") === "delete"

    const navigate = useNavigate();

    async function selectProduct() {
        const products = await window.shopify.resoucePicker({
            type: "product",
            action: "select",
        });

        if (products) {
            const { title, id, varients, images, handle } = products[0];

            setFormSate({
                ...formState,
                productId: id,
                poductVarientId: varients[0].id,
                productTitle: title,
                productHandle: handle,
                productAlt: images[0]?.altText,
                productImage: images[0]?.originalSrc,
            });
        }
    }

    const submit = useSubmit();

    function handleSave() {
        const data = {
            title: formState.title,
            productId: formState.productId || "",
            productVarientId: formState.productVarientId || "",
            productHandle: formState.productHandle || "",
            destination: formState.destination,
        };

        setCleanFormState({ ...formState });
        submit(data, { method: "post" });
    }


    return (
        <Page>
            <ui-title-bar title={qrCode.id ? "Edit QR Code" : "Create new QR Code"} >
                <button varient="breadcrumb" onClick={() => navigate("/app")}>
                    QRCodes
                </button>
            </ui-title-bar>
            <Layout>
                <Layout.Selection>
                    <BlockStack gap="500">
                        <Card >
                            <BlockStack gap="500">
                                <Text as={"h2"} varient="headingLg">
                                    Title
                                </Text>
                                <TextField
                                    id="title"
                                    helpText="only store staff can see this text"
                                    label="title"
                                    labelHidden
                                    autoComplete="off"
                                    value={formState.title}
                                    onChange={() => setFormSate({
                                        ...formState, title
                                    })}
                                    error={errors.title}
                                />
                            </BlockStack>
                        </Card>
                        <Card>
                            <BlockStack gap="500">
                                <InlineStack align="space-between">
                                    <Text as={h2} variant="headingLg">
                                        Product
                                    </Text>
                                    {formState.productId ? (
                                        <Button variant="plain" onClick={selectProduct}>
                                            Change Product
                                        </Button>
                                    ) : null}
                                </InlineStack>
                                {formState.productId ? (
                                    <InlineStack blockAlign="center" gap="500">
                                        <Thumbnail
                                            source={formState.productImage || ImageIcon}
                                            alt={formState.productAlt}
                                        />
                                        <Text as="span" variant="headingMd" fontWeight="semibold">
                                            {formState.productTitle}
                                        </Text>
                                    </InlineStack>
                                ) : (
                                    <BlockStack gap="200">
                                        <Button
                                            onClick={selectProduct} id="select-product">
                                            Select Product</Button>
                                        {errors.productId ? (
                                            <InlineError
                                                message={errors.productId}
                                                fieldID="myFieldID"
                                            />
                                        ) : null}
                                    </BlockStack>
                                )}
                                <Bleed marginInlineStart="200" marginInlineEnd="200">
                                    <Divider />
                                </Bleed>
                                <InlineStack gap="500" align="space-between" blockAlign="start">
                                    <ChoiceList
                                        title="Scan Destination"
                                        choices={[
                                            { label: "Link to product page", value: "product" },
                                            { label: "Link to checkout page with product in cart", value: "cart" }
                                        ]}
                                        selected={[formState.destination]}
                                        onChange={(destination) =>
                                            setFormSate({
                                                ...formState,
                                                destination: destination[0]
                                            })
                                        }
                                        error={errors.destination}
                                    />
                                    {qrCode.destinationUrl ? (
                                        <Button
                                            variant="plain"
                                            url={qrCode.destinationUrl}
                                            target="_blank"
                                        >
                                            Go to Destinaton URL
                                        </Button>
                                    ) : null}
                                </InlineStack>
                            </BlockStack>
                        </Card>
                    </BlockStack>
                </Layout.Selection>
                <Layout.Selection varient="oneThird">
                    <Card>
                        <Text as={"h2"} varient="headingLg"> QRCode</Text>
                        {qrCode ? (
                            <EmptyState image={qrCode.image} imageContained={true} />
                        ) : (
                            <EmptyState image="">
                                QR Code will appear here after you save
                            </EmptyState>
                        )}

                        <BlockStack gap="300">
                            <Button
                                disabled={!qrCode.image}
                                url={qrCode?.image}
                                download
                                variant="primary"
                            > Download</Button>
                            <Button
                                disabled={!qrCode.id}
                                url={`/qrcodes/${qrCode.id}`}
                                target="_blank"
                            > Go to public URL</Button>
                        </BlockStack>
                    </Card>
                </Layout.Selection>
                <Layout.Selection>
                    <PageActions
                        secondaryActions={[
                            {
                                content: "Delete",
                                loading: isDeleting,
                                destructive: true,
                                outline: true,
                                disabled: !qrCode.id || !qrCode || isDeleting || isSaving,
                                onAction: () =>
                                    submit({ action: "delete" }, { method: "post" }),

                            },
                        ]}
                    />
                </Layout.Selection>
            </Layout>
        </Page>
    );
}
