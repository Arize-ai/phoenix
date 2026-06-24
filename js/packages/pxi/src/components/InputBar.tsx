export type InputBarProps = {
  value: string;
  onInput: (value: string) => void;
  onSubmit: (value: string) => void;
  /** When true, a turn is in flight; submits are ignored upstream. */
  disabled: boolean;
};

/** Bottom input field. Enter submits; the field stays focused for the session. */
export function InputBar({
  value,
  onInput,
  onSubmit,
  disabled,
}: InputBarProps) {
  return (
    <box
      border
      borderStyle="rounded"
      borderColor="#414868"
      title="Message"
      height={3}
      marginTop={1}
      paddingLeft={1}
      paddingRight={1}
    >
      <input
        value={value}
        placeholder={
          disabled ? "Waiting for PXI…" : "Type a message, press Enter to send"
        }
        onInput={onInput}
        onSubmit={() => onSubmit(value)}
        focused
        cursorColor="#7AA2F7"
      />
    </box>
  );
}
