export const ReleaseUpdate = ({ label, href, children }) => {
  return (
    <Update label={label}>
      {children}
      <a href={href} className="release-update-read-more">
        Read the full update →
      </a>
    </Update>
  );
};
