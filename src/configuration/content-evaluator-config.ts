import { Static, Type } from "@sinclair/typebox";

export const contentEvaluatorConfigurationType = Type.Object({});

export type ContentEvaluatorConfiguration = Static<typeof contentEvaluatorConfigurationType>;
