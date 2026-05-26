const express = require('express');
const router = express.Router();
const Task = require('../models/Task');

// GET /tasks - Fetch all tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Server error while fetching tasks' });
  }
});

// POST /tasks - Create a new task
router.post('/', async (req, res) => {
  try {
    const { title, priority, category, dueDate } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const taskFields = {
      title: title.trim(),
    };

    if (priority && ['low', 'medium', 'high'].includes(priority.toLowerCase())) {
      taskFields.priority = priority.toLowerCase();
    }
    if (category !== undefined) {
      taskFields.category = category.trim() || 'General';
    }
    if (dueDate !== undefined) {
      if (dueDate) {
        const parsedDate = new Date(dueDate);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: 'Invalid due date format' });
        }
        taskFields.dueDate = parsedDate;
      } else {
        taskFields.dueDate = null;
      }
    }

    const newTask = new Task(taskFields);
    const savedTask = await newTask.save();
    res.status(201).json(savedTask);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Server error while creating task' });
  }
});

// POST /tasks/clear-completed - Delete all completed tasks
router.post('/clear-completed', async (req, res) => {
  try {
    const result = await Task.deleteMany({ completed: true });
    res.json({ message: 'Completed tasks cleared successfully', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: 'Server error while clearing completed tasks' });
  }
});

// PUT /tasks/:id - Update a task
router.put('/:id', async (req, res) => {
  try {
    const { title, completed, priority, category, dueDate } = req.body;
    const updateData = {};

    if (title !== undefined) {
      updateData.title = title.trim();
    }
    if (completed !== undefined) {
      updateData.completed = completed;
    }
    if (priority !== undefined && ['low', 'medium', 'high'].includes(priority.toLowerCase())) {
      updateData.priority = priority.toLowerCase();
    }
    if (category !== undefined) {
      updateData.category = category.trim() || 'General';
    }
    if (dueDate !== undefined) {
      if (dueDate) {
        const parsedDate = new Date(dueDate);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: 'Invalid due date format' });
        }
        updateData.dueDate = parsedDate;
      } else {
        updateData.dueDate = null;
      }
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(updatedTask);
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }
    res.status(500).json({ error: 'Server error while updating task' });
  }
});

// DELETE /tasks/:id - Delete a task
router.delete('/:id', async (req, res) => {
  try {
    const deletedTask = await Task.findByIdAndDelete(req.params.id);
    if (!deletedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully', id: req.params.id });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid task ID format' });
    }
    res.status(500).json({ error: 'Server error while deleting task' });
  }
});

module.exports = router;
