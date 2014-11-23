'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    Major = require('../major/major.model'),
    Semester = require('../semester/semester.model');

var ScheduleSchema = new Schema({
  name: String,
  comments: { type: String, default: '' },
  blessed: { type: Boolean, default: false },
  major: [{ type: Schema.Types.ObjectId, ref: 'Major' }],
  semesters: [Semester.schema]
});

module.exports = mongoose.model('Schedule', ScheduleSchema);