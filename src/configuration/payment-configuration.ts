import { Static, Type } from "@sinclair/typebox";

export const DEFAULT_FAUCET_URL = "https://ubq-faucet.workers.dev/";

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
    faucetUrl: Type.Optional(
      Type.String({
        default: DEFAULT_FAUCET_URL,
        description:
          "Faucet endpoint used to prefund beneficiary wallets with native gas after generating claim permits.",
      })
    ),
  },
  { default: {} }
);

export type PaymentConfiguration = Static<typeof paymentConfigurationType>;
