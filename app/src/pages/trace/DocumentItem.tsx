import { DocumentAttributePostfixes } from "@arizeai/openinference-semantic-conventions";

import type { TokenProps, ViewProps } from "@phoenix/components";
import {
  Card,
  ErrorBoundary,
  Flex,
  Heading,
  Icon,
  Icons,
  Token,
  View,
} from "@phoenix/components";
import { ConnectedMarkdownBlock } from "@phoenix/components/markdown";
import type { AttributeDocument } from "@phoenix/openInference/tracing/types";
import { numberFormatter } from "@phoenix/utils/numberFormatUtils";

import type { DocumentAnnotation } from "./DocumentAnnotationItem";
import { DocumentAnnotationsSection } from "./DocumentAnnotationsSection";
import { ReadonlyJSONBlock } from "./ReadonlyJSONBlock";

export function DocumentItem({
  document,
  documentAnnotations,
  backgroundColor,
  borderColor,
  tokenColor,
  spanNodeId,
  documentPosition,
}: {
  document: AttributeDocument;
  documentAnnotations?: DocumentAnnotation[] | null;
  backgroundColor: ViewProps["backgroundColor"];
  borderColor: ViewProps["borderColor"];
  tokenColor: TokenProps["color"];
  spanNodeId?: string;
  documentPosition?: number;
}) {
  const metadata = document[DocumentAttributePostfixes.metadata];
  const documentContent = document[DocumentAttributePostfixes.content];
  const canAnnotate = spanNodeId != null && documentPosition != null;
  const showAnnotationsSection = canAnnotate;
  return (
    <Card
      backgroundColor={backgroundColor}
      borderColor={borderColor}
      collapsible
      title={
        <Flex direction="row" gap="size-50" alignItems="center">
          <Icon svg={<Icons.FileOutline />} />
          <Heading level={4}>
            document {document[DocumentAttributePostfixes.id]}
          </Heading>
        </Flex>
      }
      extra={
        <Flex direction="row" gap="size-100" alignItems="center">
          {typeof document[DocumentAttributePostfixes.score] === "number" && (
            <Token color={tokenColor}>
              {`score ${numberFormatter(
                document[DocumentAttributePostfixes.score]
              )}`}
            </Token>
          )}
        </Flex>
      }
    >
      <Flex direction="column">
        {documentContent && (
          <ConnectedMarkdownBlock>{documentContent}</ConnectedMarkdownBlock>
        )}
        {metadata && (
          <>
            <View borderColor={borderColor} borderTopWidth="thin">
              <View
                paddingX="size-200"
                paddingY="size-100"
                borderColor={borderColor}
                borderBottomWidth="thin"
              >
                <Heading level={4}>Document Metadata</Heading>
              </View>
              <ReadonlyJSONBlock basicSetup={{ lineNumbers: false }}>
                {JSON.stringify(metadata)}
              </ReadonlyJSONBlock>
            </View>
          </>
        )}
        {showAnnotationsSection && (
          <ErrorBoundary>
            <DocumentAnnotationsSection
              spanNodeId={spanNodeId ?? ""}
              documentPosition={documentPosition ?? 0}
              documentAnnotations={documentAnnotations ?? []}
              borderColor={borderColor}
              tokenColor={tokenColor}
              canAnnotate={canAnnotate}
            />
          </ErrorBoundary>
        )}
      </Flex>
    </Card>
  );
}
