import { DocumentAttributePostfixes } from "@arizeai/openinference-semantic-conventions";

import {
  Card,
  CopyToClipboardButton,
  ErrorBoundary,
  Flex,
  Heading,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";
import { AnnotationLabel } from "@phoenix/components/annotation/AnnotationLabel";
import { ConnectedMarkdownBlock } from "@phoenix/components/markdown";
import type { AttributeDocument } from "@phoenix/openInference/tracing/types";

import type { DocumentAnnotation } from "./DocumentAnnotationItem";
import { DocumentAnnotationsSection } from "./DocumentAnnotationsSection";
import { ReadonlyJSONBlock } from "./ReadonlyJSONBlock";
import { ExpandableSpanContent } from "./span/ExpandableSpanContent";

export function DocumentItem({
  document,
  documentAnnotations,
  spanNodeId,
  documentPosition,
}: {
  document: AttributeDocument;
  documentAnnotations?: DocumentAnnotation[] | null;
  spanNodeId?: string;
  documentPosition?: number;
}) {
  const metadata = document[DocumentAttributePostfixes.metadata];
  const documentContent = document[DocumentAttributePostfixes.content];
  const documentScore = document[DocumentAttributePostfixes.score];
  const canAnnotate = spanNodeId != null && documentPosition != null;
  const showAnnotationsSection = canAnnotate;
  return (
    <Card
      collapsible
      title={
        <Flex direction="row" gap="size-50" alignItems="center">
          <Icon svg={<Icons.File />} />
          <Text weight="heavy">
            document {document[DocumentAttributePostfixes.id]}
          </Text>
        </Flex>
      }
      extra={
        <Flex direction="row" gap="size-100" alignItems="center">
          {typeof documentScore === "number" ? (
            <AnnotationLabel
              annotation={{ name: "score", score: documentScore }}
            />
          ) : null}
          {/* the content is what a reader reaches for; the whole document is
              the fallback for a document that recorded none */}
          <CopyToClipboardButton
            text={
              documentContent != null
                ? documentContent
                : JSON.stringify(document, null, 2)
            }
          />
        </Flex>
      }
    >
      <Flex direction="column">
        {documentContent && (
          <ExpandableSpanContent>
            <ConnectedMarkdownBlock>{documentContent}</ConnectedMarkdownBlock>
          </ExpandableSpanContent>
        )}
        {metadata && (
          <>
            <View borderColor="default" borderTopWidth="thin">
              <View
                paddingX="size-200"
                paddingY="size-100"
                borderColor="default"
                borderBottomWidth="thin"
              >
                <Heading level={4}>Document Metadata</Heading>
              </View>
              <ExpandableSpanContent>
                <ReadonlyJSONBlock basicSetup={{ lineNumbers: false }}>
                  {JSON.stringify(metadata)}
                </ReadonlyJSONBlock>
              </ExpandableSpanContent>
            </View>
          </>
        )}
        {showAnnotationsSection && (
          <ErrorBoundary>
            <DocumentAnnotationsSection
              spanNodeId={spanNodeId ?? ""}
              documentPosition={documentPosition ?? 0}
              documentAnnotations={documentAnnotations ?? []}
              canAnnotate={canAnnotate}
            />
          </ErrorBoundary>
        )}
      </Flex>
    </Card>
  );
}
