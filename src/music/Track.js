/**
 * Represents a music track
 */
class Track {
  /**
   * @param {object} data
   * @param {string} data.title
   * @param {string} data.url
   * @param {number} data.duration - duration in seconds
   * @param {string} data.requestedBy - username who requested
   * @param {string|null} data.thumbnail
   */
  constructor({ title, url, duration, requestedBy, thumbnail = null }) {
    this.title = title;
    this.url = url;
    this.duration = duration;
    this.requestedBy = requestedBy;
    this.thumbnail = thumbnail;
  }
}

module.exports = Track;
