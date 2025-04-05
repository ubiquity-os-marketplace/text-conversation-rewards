import { Static, Type } from "@sinclair/typebox";

export const paymentConfigurationType = Type.Object(
  {
    /**
     *  If set to false or if there are insufficient funds to settle the payment,
     *  permits will be generated instead of processing direct payouts.
     *  Also, if this config was missing the default behavior is to consider it true.
     */
    automaticTransferMode: Type.Optional(
      Type.Boolean({
        default: true,
        description:
          "If set to false, or if there are insufficient funds to settle the payment, permits will be generated instead of immediately transferring rewards to the beneficiaries.",
      })
    ),
  },
  { default: {} }
);

export type PaymentConfiguration = Static<typeof paymentConfigurationType>;
