const bcrypt = require('bcrypt');
const employee = require('../models/employeeSchema.js');
const Subject = require('../models/subjectSchema.js');

const employeeRegister = async (req, res) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(req.body.password, salt);

        const existingemployee = await employee.findOne({
            rollNum: req.body.rollNum,
            school: req.body.adminID,
            sclassName: req.body.sclassName,
        });

        if (existingemployee) {
            res.send({ message: 'Roll Number already exists' });
        }
        else {
            const employee = new employee({
                ...req.body,
                school: req.body.adminID,
                password: hashedPass
            });

            let result = await employee.save();

            result.password = undefined;
            res.send(result);
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const employeeLogIn = async (req, res) => {
    try {
        let employee = await employee.findOne({ rollNum: req.body.rollNum, name: req.body.employeeName });
        if (employee) {
            const validated = await bcrypt.compare(req.body.password, employee.password);
            if (validated) {
                employee = await employee.populate("school", "schoolName")
                employee = await employee.populate("sclassName", "sclassName")
                employee.password = undefined;
                employee.examResult = undefined;
                employee.attendance = undefined;
                res.send(employee);
            } else {
                res.send({ message: "Invalid password" });
            }
        } else {
            res.send({ message: "employee not found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const getemployees = async (req, res) => {
    try {
        let employees = await employee.find({ school: req.params.id }).populate("sclassName", "sclassName");
        if (employees.length > 0) {
            let modifiedemployees = employees.map((employee) => {
                return { ...employee._doc, password: undefined };
            });
            res.send(modifiedemployees);
        } else {
            res.send({ message: "No employees found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
};

const getemployeeDetail = async (req, res) => {
    try {
        let employee = await employee.findById(req.params.id)
            .populate("school", "schoolName")
            .populate("sclassName", "sclassName")
            .populate("examResult.subName", "subName")
            .populate("attendance.subName", "subName sessions");
        if (employee) {
            employee.password = undefined;
            res.send(employee);
        }
        else {
            res.send({ message: "No employee found" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
}

const deleteemployee = async (req, res) => {
    try {
        const result = await employee.findByIdAndDelete(req.params.id)
        res.send(result)
    } catch (error) {
        res.status(500).json(err);
    }
}

const deleteemployees = async (req, res) => {
    try {
        const result = await employee.deleteMany({ school: req.params.id })
        if (result.deletedCount === 0) {
            res.send({ message: "No employees found to delete" })
        } else {
            res.send(result)
        }
    } catch (error) {
        res.status(500).json(err);
    }
}

const deleteemployeesByClass = async (req, res) => {
    try {
        const result = await employee.deleteMany({ sclassName: req.params.id })
        if (result.deletedCount === 0) {
            res.send({ message: "No employees found to delete" })
        } else {
            res.send(result)
        }
    } catch (error) {
        res.status(500).json(err);
    }
}

const updateemployee = async (req, res) => {
    try {
        if (req.body.password) {
            const salt = await bcrypt.genSalt(10)
            res.body.password = await bcrypt.hash(res.body.password, salt)
        }
        let result = await employee.findByIdAndUpdate(req.params.id,
            { $set: req.body },
            { new: true })

        result.password = undefined;
        res.send(result)
    } catch (error) {
        res.status(500).json(error);
    }
}

const updateExamResult = async (req, res) => {
    const { subName, marksObtained } = req.body;

    try {
        const employee = await employee.findById(req.params.id);

        if (!employee) {
            return res.send({ message: 'employee not found' });
        }

        const existingResult = employee.examResult.find(
            (result) => result.subName.toString() === subName
        );

        if (existingResult) {
            existingResult.marksObtained = marksObtained;
        } else {
            employee.examResult.push({ subName, marksObtained });
        }

        const result = await employee.save();
        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const employeeAttendance = async (req, res) => {
    const { subName, status, date } = req.body;

    try {
        const employee = await employee.findById(req.params.id);

        if (!employee) {
            return res.send({ message: 'employee not found' });
        }

        const subject = await Subject.findById(subName);

        const existingAttendance = employee.attendance.find(
            (a) =>
                a.date.toDateString() === new Date(date).toDateString() &&
                a.subName.toString() === subName
        );

        if (existingAttendance) {
            existingAttendance.status = status;
        } else {
            // Check if the employee has already attended the maximum number of sessions
            const attendedSessions = employee.attendance.filter(
                (a) => a.subName.toString() === subName
            ).length;

            if (attendedSessions >= subject.sessions) {
                return res.send({ message: 'Maximum attendance limit reached' });
            }

            employee.attendance.push({ date, status, subName });
        }

        const result = await employee.save();
        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const clearAllemployeesAttendanceBySubject = async (req, res) => {
    const subName = req.params.id;

    try {
        const result = await employee.updateMany(
            { 'attendance.subName': subName },
            { $pull: { attendance: { subName } } }
        );
        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const clearAllemployeesAttendance = async (req, res) => {
    const schoolId = req.params.id

    try {
        const result = await employee.updateMany(
            { school: schoolId },
            { $set: { attendance: [] } }
        );

        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};

const removeemployeeAttendanceBySubject = async (req, res) => {
    const employeeId = req.params.id;
    const subName = req.body.subId

    try {
        const result = await employee.updateOne(
            { _id: employeeId },
            { $pull: { attendance: { subName: subName } } }
        );

        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};


const removeemployeeAttendance = async (req, res) => {
    const employeeId = req.params.id;

    try {
        const result = await employee.updateOne(
            { _id: employeeId },
            { $set: { attendance: [] } }
        );

        return res.send(result);
    } catch (error) {
        res.status(500).json(error);
    }
};


module.exports = {
    employeeRegister,
    employeeLogIn,
    getemployees,
    getemployeeDetail,
    deleteemployees,
    deleteemployee,
    updateemployee,
    employeeAttendance,
    deleteemployeesByClass,
    updateExamResult,

    clearAllemployeesAttendanceBySubject,
    clearAllemployeesAttendance,
    removeemployeeAttendanceBySubject,
    removeemployeeAttendance,
};