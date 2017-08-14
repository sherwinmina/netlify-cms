import React from 'react';
import bytes from 'bytes';
import { Table, TableHead, TableRow, TableCell } from 'react-toolbox/lib/table';

export default class MediaLibraryTable extends React.Component {
  /**
   * We would generally use an HOC to preload props into the TableCell
   * component, but React Toolbox won't process the component properly if it's
   * wrapped in an HOC. Instead, we use this prop getter on each TableCell
   * instance to avoid repetition.
   */
  getHeadCellProps(name, opts = {}) {
    const { sort = true, style = {} } = opts;
    const { hasMedia, getSortDirection, onSortClick } = this.props;
    const canSort = hasMedia && sort;
    const cursor = canSort ? 'pointer' : 'auto';
    return {
      sorted: canSort ? getSortDirection(name) : null,
      onClick: () => canSort && onSortClick(name),
      style: { ...style, cursor },
      theme: {
        headCell: 'nc-mediaLibrary-headCell',
        sortIcon: 'nc-mediaLibrary-sortIcon',
      },
    };
  }

  render () {
    const {
      data,
      selectedFile,
      onRowSelect,
      onRowFocus,
      onRowBlur,
      getSortDirection,
      onSortClick,
    } = this.props;

    return (
      <Table>
        <TableHead>
          <TableCell { ...this.getHeadCellProps('image', { sort: false, style: { width: '92px' } }) }>
            Image
          </TableCell>
          <TableCell { ...this.getHeadCellProps('name') }>Name</TableCell>
          <TableCell { ...this.getHeadCellProps('type') }>Type</TableCell>
          <TableCell { ...this.getHeadCellProps('size') }>Size</TableCell>
        </TableHead>
        {
          data.map((file, idx) =>
            <TableRow
              key={idx}
              selected={selectedFile.id === file.id }
              onFocus={onRowFocus}
              onBlur={onRowBlur}
              onSelect={() => onRowSelect(data[idx])}
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onRowSelect(data[idx]);
              }}
            >
              <TableCell>
                {
                  !file.isImage ? null :
                    <a href={file.url} target="_blank" tabIndex="-1">
                      <img src={file.url} className="nc-mediaLibrary-thumbnail"/>
                    </a>
                }
              </TableCell>
              <TableCell>{file.name}</TableCell>
              <TableCell>{file.type}</TableCell>
              <TableCell>{bytes(file.size, { decimalPlaces: 0 })}</TableCell>
            </TableRow>
          )
        }
      </Table>
    );
  }
}
