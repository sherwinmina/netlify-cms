import React from 'react';
import { connect } from 'react-redux';
import { orderBy, get, last, isEmpty, map } from 'lodash';
import fuzzy from 'fuzzy';
import Dialog from '../UI/Dialog';
import { resolvePath } from '../../lib/pathHelper';
import { changeDraftField } from '../../actions/entries';
import {
  loadMedia as loadMediaAction,
  persistMedia as persistMediaAction,
  deleteMedia as deleteMediaAction,
  insertMedia as insertMediaAction,
  closeMediaLibrary as closeMediaLibraryAction,
} from '../../actions/mediaLibrary';
import MediaLibraryTable from './MediaLibraryTable';
import MediaLibraryFooter from './MediaLibraryFooter';

/**
 * Key used to store user's last sort settings in local storage.
 */
const MEDIA_LIBRARY_SORT_KEY = 'cms.medlib-sort';

/**
 * Default sort value.
 */
const DEFAULT_SORT = [{ fieldName: 'name', direction: 'asc' }];

/**
 * Extensions used to determine which files to show when the media library is
 * accessed from an image insertion field.
 */
const IMAGE_EXTENSIONS = [ 'jpg', 'jpeg', 'webp', 'gif', 'png', 'bmp', 'svg', 'tiff' ];


class MediaLibrary extends React.Component {

  /**
   * The currently selected file, query, and sort are tracked in component state
   * as they do not impact the rest of the application.
   */
  state = {
    selectedFile: {},
    query: '',
    sortFields: JSON.parse(localStorage.getItem(MEDIA_LIBRARY_SORT_KEY)) || DEFAULT_SORT,
  };

  componentDidMount() {
    this.props.loadMedia();
  }

  componentWillReceiveProps(nextProps) {
    /**
     * We clear old state from the media library when it's being re-opened
     * because, when doing so on close, the state is cleared while the media
     * library is still fading away.
     */
    const isOpening = !this.props.isVisible && nextProps.isVisible;
    if (isOpening) {
      this.setState({ selectedFile: {}, query: '' });
    }
  }

  /**
   * Filter an array of file data to include only images.
   */
  filterImages = files => {
    return files ? files.filter(file => IMAGE_EXTENSIONS.includes(last(file.name.split('.')))) : [];
  };

  /**
   * Transform file data for table display.
   */
  toTableData = files => {
    const tableData = files && files.map(({ id, name, size, queryOrder, url, urlIsPublicPath }) => {
      const ext = last(name.split('.'));
      return {
        id,
        name,
        type: ext.toUpperCase(),
        size,
        queryOrder,
        url,
        urlIsPublicPath,
        isImage: IMAGE_EXTENSIONS.includes(ext),
      };
    });

    /**
     * Get the sort order for use with `lodash.orderBy`, and always add the
     * `queryOrder` sort as the lowest priority sort order.
     */
    const { sortFields } = this.state;
    const fieldNames = map(sortFields, 'fieldName').concat('queryOrder');
    const directions = map(sortFields, 'direction').concat('asc');
    return orderBy(tableData, fieldNames, directions);
  };

  handleClose = () => {
    this.props.closeMediaLibrary();
  };

  /**
   * Select a row when the checkbox is clicked, or unselect if already selected.
   */
  handleRowSelect = row => {
    const selectedFile = this.state.selectedFile.id === row.id ? {} : row;
    this.setState({ selectedFile });
  };

  /**
   * Sets sort state for a sortable field when its header is clicked.
   */
  handleSortClick = fieldName => {
    /**
     * Get the current sort direction for the field being sorted.
     */
    const { sortFields } = this.state;
    const currentSort = sortFields.find(sort => sort.fieldName === fieldName) || {};
    const { direction } = currentSort;

    /**
     * If a field is not sorted, or the user has not clicked through both sort
     * directions, the current click should result in a new sort for the field.
     */
    const shouldSort = !direction || direction === 'asc';

    /**
     * Create an object representing the new sort. If this is a falsey value,
     * the field sort will be removed.
     */
    const newSortField = shouldSort && { fieldName, direction: !direction ? 'asc' : 'desc' };

    /**
     * Get the sort objects for all fields except the field currently being
     * updated.
     */
    const remainingSorts = sortFields.filter(sort => sort.fieldName !== fieldName);

    /**
     * Update all sorts by prepending the new sort, or by returning the existing
     * sorts with the current field's sort removed.
     */
    const newSort = shouldSort ? [newSortField, ...remainingSorts] : remainingSorts;

    /**
     * Store the update sorts in local storage and update state.
     */
    localStorage.setItem(MEDIA_LIBRARY_SORT_KEY, JSON.stringify(newSort));
    this.setState({ sortFields: newSort });
  }

  /**
   * Get sort direction for a field.
   */
  getSortDirection = fieldName => {
    const { sortFields } = this.state;
    const sort = sortFields.find(sort => sort.fieldName === fieldName);
    return get(sort, 'direction');
  };

  /**
   * Upload a file.
   */
  handlePersist = event => {
    /**
     * Stop the browser from automatically handling the file input click, and
     * get the file for upload.
     */
    event.stopPropagation();
    event.preventDefault();
    const { loadMedia, persistMedia, privateUpload } = this.props;
    const { files: fileList } = event.dataTransfer || event.target;
    const files = [...fileList];
    const file = files[0];

    /**
     * Upload the selected file, then refresh the media library. This should be
     * improved in the future, but isn't currently resulting in noticeable
     * performance/load time issues.
     */
    return persistMedia(file, privateUpload)
      .then(() => loadMedia({ query: this.state.query }));
  };

  /**
   * Stores the public path of the file in the application store, where the
   * editor field that launched the media library can retrieve it.
   */
  handleInsert = () => {
    const { selectedFile } = this.state;
    const { name, url, urlIsPublicPath } = selectedFile;
    const { insertMedia, publicFolder } = this.props;
    const publicPath = urlIsPublicPath ? url : resolvePath(name, publicFolder);
    insertMedia(publicPath);
    this.handleClose();
  };

  /**
   * Removes the selected file from the backend.
   */
  handleDelete = () => {
    const { selectedFile } = this.state;
    const { files, deleteMedia } = this.props;
    if (!window.confirm('Are you sure you want to delete selected media?')) {
      return;
    }
    const file = files.find(file => selectedFile.id === file.id);
    deleteMedia(file)
      .then(() => {
        this.setState({ selectedFile: {} });
      });
  };

  /**
   * Executes media library search for implementations that support dynamic
   * search via request. For these implementations, the Enter key must be
   * pressed to execute search. If assets are being stored directly through
   * the GitHub backend, search is in-memory and occurs as the query is typed,
   * so this handler has no impact.
   */
  handleSearchKeyDown = (event, dynamicSearch) => {
    if (event.key === 'Enter' && dynamicSearch) {
      this.props.loadMedia({ query: this.state.query });
    }
  };

  /**
   * Updates query state as the user types in the search field.
   */
  handleSearchChange = event => {
    this.setState({ query: event.target.value });
  };

  /**
   * Filters files that do not match the query. Not used for dynamic search.
   */
  queryFilter = (query, files) => {
    /**
     * Because file names don't have spaces, typing a space eliminates all
     * potential matches, so we strip them all out internally before running the
     * query.
     */
    const strippedQuery = query.replace(/ /g, '');
    const matches = fuzzy.filter(strippedQuery, files, { extract: file => file.name });
    const matchFiles = matches.map((match, queryIndex) => {
      const file = files[match.index];
      return { ...file, queryIndex };
    });
    return matchFiles;
  };

  /**
   * Adds row focus styling, and scrolls the focused row into view if it's not
   * already visible.
   */
  handleRowFocus = event => {
    const scrollContainer = this.tableScrollRef.parentElement;
    const scrollContainerInnerHeight = scrollContainer.clientHeight;
    const scrollContainerBottomPadding = 130;
    const scrollElement = this.tableScrollRef;
    const scrollPosition = scrollElement.scrollTop;
    const row = event.currentTarget;
    const rowHeight = row.offsetHeight;
    const rowPosition = row.offsetTop;

    event.currentTarget.classList.add('nc-mediaLibrary-rowFocused');

    const rowAboveVisibleArea = scrollPosition > rowPosition;

    if (rowAboveVisibleArea) {
      scrollElement.scrollTop = rowPosition;
      return;
    }

    const effectiveScrollPosition = scrollContainerInnerHeight + scrollPosition;
    const effectiveRowPosition = rowPosition + rowHeight + scrollContainerBottomPadding;
    const rowBelowVisibleArea = effectiveScrollPosition < effectiveRowPosition;

    if (rowBelowVisibleArea) {
      const scrollTopOffset = scrollContainerInnerHeight - scrollContainerBottomPadding - rowHeight;
      scrollElement.scrollTop = rowPosition - scrollTopOffset;
    }
  };

  /**
   * Remove row focus styling on blur.
   */
  handleRowBlur = event => {
    event.currentTarget.classList.remove('nc-mediaLibrary-rowFocused');
  };

  render() {
    const { isVisible, canInsert, files, dynamicSearch, forImage, isLoading, isPersisting, isDeleting } = this.props;
    const { query, selectedFile } = this.state;
    const filteredFiles = forImage ? this.filterImages(files) : files;
    const queriedFiles = (!dynamicSearch && query) ? this.queryFilter(query, filteredFiles) : filteredFiles;
    const tableData = this.toTableData(queriedFiles);
    const hasFiles = files && !!files.length;
    const hasFilteredFiles = filteredFiles && !!filteredFiles.length;
    const hasSearchResults = queriedFiles && !!queriedFiles.length;
    const hasMedia = hasSearchResults;
    const shouldShowProgressBar = isPersisting || isDeleting || isLoading;
    const loadingMessage = (isPersisting && 'Uploading...')
      || (isDeleting && 'Deleting...')
      || (isLoading && 'Loading...');
    const emptyMessage = (!hasFilteredFiles && 'No images found.')
      || (!hasFiles && 'No files found.')
      || (!hasSearchResults && 'No results.');

    return (
      <Dialog
        isVisible={isVisible}
        isLoading={shouldShowProgressBar}
        loadingMessage={loadingMessage}
        onClose={this.handleClose}
        footer={
          <MediaLibraryFooter
            onDelete={this.handleDelete}
            onPersist={this.handlePersist}
            onClose={this.handleClose}
            onInsert={this.handleInsert}
            hasSelection={hasMedia && !isEmpty(selectedFile)}
            forImage={forImage}
            canInsert={canInsert}
          />
        }
      >
        <h1>{forImage ? 'Images' : 'Assets'}</h1>
        <input
          className="nc-mediaLibrary-searchInput"
          value={query}
          onChange={this.handleSearchChange}
          onKeyDown={event => this.handleSearchKeyDown(event, dynamicSearch)}
          placeholder="Search..."
          disabled={!hasFilteredFiles}
          autoFocus
        />
        <div className="nc-mediaLibrary-tableContainer">
          <div className="nc-mediaLibrary-tableContainer-inner" ref={ref => this.tableScrollRef = ref}>
            <MediaLibraryTable
              data={tableData}
              selectedFile={selectedFile}
              hasMedia={hasMedia}
              onRowSelect={this.handleRowSelect}
              onRowFocus={this.handleRowFocus}
              onRowBlur={this.handleRowBlur}
              getSortDirection={this.getSortDirection}
              onSortClick={this.handleSortClick}
            />
            { hasMedia ? null : <div className="nc-mediaLibrary-emptyMessage"><h1>{emptyMessage}</h1></div> }
          </div>
        </div>
      </Dialog>
    );
  }
}

const mapStateToProps = state => {
  const { config, mediaLibrary } = state;
  const configProps = {
    publicFolder: config.get('public_folder'),
  };
  const mediaLibraryProps = {
    isVisible: mediaLibrary.get('isVisible'),
    canInsert: mediaLibrary.get('canInsert'),
    files: mediaLibrary.get('files'),
    dynamicSearch: mediaLibrary.get('dynamicSearch'),
    forImage: mediaLibrary.get('forImage'),
    isLoading: mediaLibrary.get('isLoading'),
    isPersisting: mediaLibrary.get('isPersisting'),
    isDeleting: mediaLibrary.get('isDeleting'),
    privateUpload: mediaLibrary.get('privateUpload'),
  };
  return { ...configProps, ...mediaLibraryProps };
};

const mapDispatchToProps = {
  loadMedia: loadMediaAction,
  persistMedia: persistMediaAction,
  deleteMedia: deleteMediaAction,
  insertMedia: insertMediaAction,
  closeMediaLibrary: closeMediaLibraryAction,
};

export default connect(mapStateToProps, mapDispatchToProps)(MediaLibrary);
