import React from "react";

import { Card, TextArea } from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

import { PlaygroundInstanceProps } from "./types";

interface PlaygroundChatTemplateProps extends PlaygroundInstanceProps {}
export function PlaygroundChatTemplate(props: PlaygroundChatTemplateProps) {
  const id = props.playgroundInstanceId;
  // TODO: remove the hard coding of the first instance
  const instances = usePlaygroundContext((state) => state.instances);
  const updateInstance = usePlaygroundContext((state) => state.updateInstance);
  const playground = instances.find((instance) => instance.id === id);
  if (!playground) {
    throw new Error(`Playground instance ${id} not found`);
  }
  const { template } = playground;
  if (template.__type !== "chat") {
    throw new Error(`Invalid template type ${template.__type}`);
  }

  return (
    <ul>
      {template.messages.map((message, index) => {
        return (
          <li key={index}>
            <Card title={message.role} variant="compact">
              <TextArea
                height={100}
                value={message.content}
                onChange={(val) => {
                  updateInstance({
                    instanceId: id,
                    patch: {
                      template: {
                        __type: "chat",
                        messages: template.messages.map((message, i) =>
                          i === index ? { ...message, content: val } : message
                        ),
                      },
                    },
                  });
                }}
              />
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
