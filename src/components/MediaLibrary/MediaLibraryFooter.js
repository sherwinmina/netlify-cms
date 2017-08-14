import React from 'react';
import { Button, BrowseButton } from 'react-toolbox/lib/button';

const MediaLibraryFooter = ({
  onDelete,
  onPersist,
  onClose,
  onInsert,
  hasSelection,
  forImage,
  canInsert,
}) =>
  <div>
    <Button
      label="Delete"
      onClick={onDelete}
      className="nc-mediaLibrary-buttonLeft"
      disabled={!hasSelection}
      accent
      raised
    />
    <BrowseButton
      label="Upload"
      accept={forImage}
      onChange={onPersist}
      className="nc-mediaLibrary-buttonLeft"
      primary
      raised
    />
    <Button
      label="Close"
      onClick={onClose}
      className="nc-mediaLibrary-buttonRight"
      raised
    />
    { !canInsert ? null :
      <Button
        label="Insert"
        onClick={onInsert}
        className="nc-mediaLibrary-buttonRight"
        disabled={!hasSelection}
        primary
        raised
      />
    }
  </div>;

export default MediaLibraryFooter;
